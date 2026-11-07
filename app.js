/* Seal X2 frontend — public publishable key only. */
const SUPABASE_URL = "https://hftmfcfaikjkepawppvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_kmhzdsmzZjVAG4pAgwj7gg_GovehO0i";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let sessionUser = null, profile = null, authMode = "login", activeExam = null, activeQuestions = [], dangerUnlocked = false;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateLabel = v => new Date(v).toLocaleDateString("ar-EG",{year:"numeric",month:"short",day:"numeric"});
const isStaff = () => ["teacher","admin","owner"].includes(profile?.role);
const isOwner = () => profile?.role === "owner";
function toast(m){const e=$("#toast");if(!e)return;e.textContent=m;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2800)}
function setStatus(s,m,bad=false){const e=$(s);if(e){e.textContent=m;e.classList.toggle("error",bad)}}
function setAuthMode(mode){
 authMode=mode;
 $$("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
 $("#displayNameWrap").hidden=mode!=="signup";
 $("#authTitle").textContent=mode==="signup"?"إنشاء حساب طالب":"تسجيل الدخول";
 $("#authDescription").textContent=mode==="signup"?"الحساب الجديد يحصل تلقائيًا على صلاحية طالب.":"أدخل بريدك الإلكتروني وكلمة المرور للمتابعة.";
 $("#authForm .auth-submit").textContent=mode==="signup"?"إنشاء الحساب":"تسجيل الدخول";
}
async function loadProfile(){
 profile=null;if(!sessionUser)return;
 const {data,error}=await db.from("profiles").select("display_name,role").eq("id",sessionUser.id).maybeSingle();
 if(error){console.error("Profile:",error);return} profile=data;
}
function updateAuthUI(){
 const logged=!!sessionUser;
 $("#authOpen").hidden=logged;$("#logoutBtn").hidden=!logged;$("#userBadge").hidden=!logged;
 $("#userBadge").textContent=profile?.display_name||sessionUser?.email||"";
 $("#dashboard").hidden=!logged;$("#teacherPanel").hidden=!isStaff();$("#ownerTools").hidden=!isOwner();
 if(!isOwner()){dangerUnlocked=false;$("#dangerContent").hidden=true;$("#dangerUnlockBtn").textContent="فتح أدوات الطوارئ";}
 if(logged)loadAttempts();
 if(isStaff()){loadSubjects();loadStaffExams()}
 if(isOwner())loadAccounts();
 $("#roleLabel").textContent=isOwner()?"OWNER CONTROL":profile?.role==="admin"?"ADMIN WORKSPACE":profile?.role==="teacher"?"TEACHER WORKSPACE":"STAFF";
}
async function refreshSession(){
 const {data,error}=await db.auth.getSession();if(error)console.error(error);
 sessionUser=data?.session?.user||null;await loadProfile();updateAuthUI();
 await Promise.all([loadExams(),loadResources(),loadAnnouncements()]);
}
async function loadExams(){
 const target=$("#examGrid");
 const {data,error}=await db.from("exams").select("id,title,description,duration_minutes,created_at,allow_retake,show_score,pass_percent,shuffle_questions,subjects(name)").eq("published",true).order("created_at",{ascending:false});
 if(error){console.error(error);target.innerHTML='<div class="loading-card">تعذر تحميل الامتحانات. حاول تحديث الصفحة.</div>';return}
 if(!data?.length){target.innerHTML='<div class="loading-card">لا توجد امتحانات منشورة حالياً. ستظهر هنا عند نشر أول امتحان.</div>';return}
 let ids=[];if(sessionUser){const a=await db.rpc("get_my_exam_ids");if(!a.error)ids=(a.data||[]).map(x=>x.exam_id)}
 const done=new Set(ids);
 target.innerHTML=data.map(e=>{
  const blocked=!e.allow_retake&&done.has(e.id);
  return '<article class="content-card"><span class="card-icon">✎</span><h3>'+esc(e.title)+'</h3><p>'+esc(e.description||"اختبار العلوم المتكاملة")+'</p><div class="student-exam-meta"><span class="exam-pill">'+esc(e.subjects?.name||"العلوم المتكاملة")+'</span><span>'+e.duration_minutes+' دقيقة</span><span>'+e.pass_percent+'% للنجاح</span></div><div class="card-foot"><span>'+(blocked?"تمت المحاولة":"اختيار من متعدد")+'</span><button '+(blocked?"disabled":"")+' data-start-exam="'+e.id+'">'+(blocked?"غير متاح":"ابدأ الامتحان ↗")+'</button></div></article>';
 }).join("");
 $$("[data-start-exam]").forEach(b=>b.addEventListener("click",()=>startExam(b.dataset.startExam)));
}
async function loadResources(){
 const t=$("#resourceGrid"),{data,error}=await db.from("resources").select("*").eq("published",true).order("created_at",{ascending:false});
 if(error){console.error(error);t.innerHTML='<div class="loading-card">تعذر تحميل المصادر.</div>';return}
 if(!data?.length){t.innerHTML='<div class="loading-card">سيتم إضافة المصادر التعليمية هنا.</div>';return}
 t.innerHTML=data.map(r=>'<article class="content-card"><span class="card-icon">▤</span><h3>'+esc(r.title)+'</h3><p>'+esc(r.description)+'</p><div class="card-foot"><span>مصدر تعليمي</span><a href="'+esc(r.resource_url)+'" target="_blank" rel="noopener noreferrer">فتح المصدر ↗</a></div></article>').join("");
}
async function loadAnnouncements(){
 const t=$("#announcementList"),{data,error}=await db.from("announcements").select("*").eq("published",true).order("pinned",{ascending:false}).order("created_at",{ascending:false});
 if(error){console.error(error);t.innerHTML='<div class="loading-card">تعذر تحميل الإعلانات.</div>';return}
 if(!data?.length){t.innerHTML='<div class="loading-card">لا توجد إعلانات حالياً.</div>';return}
 t.innerHTML=data.map(a=>'<article class="announcement-item"><small>'+(a.pinned?"✦ إعلان مهم · ":"")+dateLabel(a.created_at)+'</small><h3>'+esc(a.title)+'</h3><p>'+esc(a.body)+'</p></article>').join("");
}
async function loadAttempts(){
 const t=$("#attemptList"),{data,error}=await db.rpc("get_my_attempts");
 if(error){console.error(error);t.textContent="تعذر تحميل النتائج.";return}
 t.innerHTML=data?.length?data.map(a=>'<div class="attempt-item"><span>'+esc(a.exam_title||"امتحان")+'<br><small>'+dateLabel(a.submitted_at)+'</small></span><b>'+(a.score===null?"تم التسليم":a.score+" / "+a.max_score)+'</b></div>').join(""):'<div class="loading-card">ستظهر نتائجك هنا بعد حل أول امتحان.</div>';
}
async function loadSubjects(){
 const s=$("#subjectSelect"),{data,error}=await db.from("subjects").select("id,name").order("name");
 if(error){console.error(error);s.innerHTML='<option value="">تعذر تحميل المواد</option>';return}
 const rows=(data||[]).filter(x=>x.name==="العلوم المتكاملة");
 s.innerHTML=rows.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")||'<option value="">مادة العلوم المتكاملة غير موجودة</option>';
}
function addQuestion(){
 const host=$("#questionBuilder"),n=host.querySelectorAll(".question-card").length+1,card=document.createElement("section");
 card.className="question-card";
 card.innerHTML='<div class="question-card-head"><b>السؤال '+n+'</b><button type="button" class="btn btn-outline btn-small" data-remove-question>حذف</button></div><label>نص السؤال<textarea class="question-prompt" rows="2" maxlength="1200" required placeholder="اكتب السؤال هنا"></textarea></label><div class="options-grid">'+[0,1,2,3].map((x)=>'<label>الاختيار '+(x+1)+'<input class="question-option" maxlength="300" required placeholder="اكتب الاختيار"></label>').join("")+'</div><div class="settings-grid"><label>الإجابة الصحيحة<select class="question-correct"><option value="0">الاختيار الأول</option><option value="1">الاختيار الثاني</option><option value="2">الاختيار الثالث</option><option value="3">الاختيار الرابع</option></select></label><label>درجة السؤال<input class="question-points" type="number" min="1" max="100" value="1" required></label></div>';
 host.appendChild(card);renumberQuestions();
}
function renumberQuestions(){$$(".question-card").forEach((c,i)=>$(".question-card-head b",c).textContent="السؤال "+(i+1))}
function collectQuestions(){
 const cards=$$(".question-card",$("#questionBuilder"));if(!cards.length)throw new Error("أضف سؤالاً واحداً على الأقل.");
 return cards.map((c,i)=>{
  const prompt=$(".question-prompt",c).value.trim(),options=$$(".question-option",c).map(x=>x.value.trim()),correct=Number($(".question-correct",c).value),points=Number($(".question-points",c).value);
  if(!prompt||options.some(x=>!x))throw new Error("أكمل نص السؤال والاختيارات في السؤال "+(i+1)+".");
  if(!Number.isInteger(points)||points<1||points>100)throw new Error("درجة السؤال "+(i+1)+" يجب أن تكون من 1 إلى 100.");
  return {prompt,options,correct_option:correct,points,sort_order:i};
 });
}
async function saveExam(event){
 event.preventDefault();if(!isStaff()||!sessionUser)return toast("ليس لديك صلاحية إنشاء امتحان.");
 const form=event.currentTarget,button=$('button[type="submit"]',form),v=new FormData(form);button.disabled=true;setStatus("#examStatus","جارٍ حفظ الامتحان...");
 try{
  const questions=collectQuestions(),subject=String(v.get("subject")||"");
  if(!subject)throw new Error("تعذر تحديد مادة العلوم المتكاملة.");
  const payload={title:String(v.get("title")||"").trim(),description:String(v.get("description")||"").trim(),subject_id:subject,duration_minutes:Number(v.get("duration")),pass_percent:Number(v.get("passPercent")),shuffle_questions:v.has("shuffle"),allow_retake:v.has("retake"),show_score:v.has("showScore"),published:v.has("published"),created_by:sessionUser.id};
  if(!payload.title)throw new Error("اكتب عنوان الامتحان.");
  if(!Number.isInteger(payload.duration_minutes)||payload.duration_minutes<5||payload.duration_minutes>180)throw new Error("مدة الامتحان يجب أن تكون بين 5 و180 دقيقة.");
  if(!Number.isInteger(payload.pass_percent)||payload.pass_percent<0||payload.pass_percent>100)throw new Error("نسبة النجاح يجب أن تكون بين 0 و100.");
  const created=await db.from("exams").insert(payload).select("id").single();if(created.error)throw created.error;
  const rows=questions.map(q=>({exam_id:created.data.id,prompt:q.prompt,options:q.options,correct_option:q.correct_option,points:q.points,sort_order:q.sort_order}));
  const inserted=await db.from("exam_questions").insert(rows);
  if(inserted.error){console.error(inserted.error);throw new Error("تم إنشاء سجل الامتحان لكن تعذر حفظ الأسئلة. راجع صلاحيات قاعدة البيانات.");}
  form.reset();$("#questionBuilder").innerHTML="";addQuestion();
  await Promise.all([loadExams(),loadStaffExams()]);
  setStatus("#examStatus",payload.published?"تم حفظ الامتحان ونشره بنجاح.":"تم حفظ الامتحان كمسودة.");toast("تم حفظ الامتحان.");
 }catch(e){console.error(e);setStatus("#examStatus",e.message||"حدث خطأ أثناء حفظ الامتحان.",true)}
 finally{button.disabled=false}
}
async function loadStaffExams(){
 const t=$("#staffExamList");if(!t||!isStaff())return;
 const {data,error}=await db.from("exams").select("id,title,published,created_at").order("created_at",{ascending:false}).limit(30);
 if(error){console.error(error);t.textContent="تعذر تحميل قائمة الامتحانات.";return}
 if(!data?.length){t.innerHTML='<div class="empty-state">لم يتم إنشاء امتحانات بعد.</div>';return}
 t.innerHTML=data.map(e=>'<div class="staff-row"><span><b>'+esc(e.title)+'</b><small>'+dateLabel(e.created_at)+'</small></span><button type="button" class="btn btn-small '+(e.published?"btn-outline":"btn-primary")+'" data-toggle-exam="'+e.id+'" data-published="'+e.published+'">'+(e.published?"إلغاء النشر":"نشر")+'</button></div>').join("");
 $$("[data-toggle-exam]").forEach(b=>b.addEventListener("click",async()=>{
  b.disabled=true;const {error}=await db.from("exams").update({published:b.dataset.published!=="true"}).eq("id",b.dataset.toggleExam);
  if(error){console.error(error);toast("تعذر تغيير حالة النشر.")}else{toast("تم تحديث حالة الامتحان.");await Promise.all([loadStaffExams(),loadExams()])}b.disabled=false;
 }));
}
async function loadAccounts(){
 const t=$("#accountList");if(!t||!isOwner())return;
 const {data,error}=await db.from("profiles").select("id,display_name,role,created_at").order("created_at",{ascending:false}).limit(100);
 if(error){console.error(error);t.textContent="تعذر تحميل الحسابات.";return}
 if(!data?.length){t.innerHTML='<div class="empty-state">لا توجد حسابات مسجلة بعد.</div>';return}
 t.innerHTML=data.map(a=>'<div class="staff-row account-row"><span><b>'+esc(a.display_name||"طالب")+'</b><small>'+esc(a.id.slice(0,8))+'… · '+esc(a.role)+'</small></span><select data-account-role="'+a.id+'" aria-label="تغيير صلاحية الحساب">'+["student","teacher","admin"].map(r=>'<option value="'+r+'" '+(a.role===r?"selected":"")+'>'+r+'</option>').join("")+'</select></div>').join("");
 $$("[data-account-role]").forEach(s=>s.addEventListener("change",async()=>{
  const id=s.dataset.accountRole,role=s.value;s.disabled=true;
  const {error}=await db.rpc("owner_set_role",{p_user_id:id,p_role:role});
  if(error){console.error(error);toast(error.message?.includes("duplicate")?"يوجد حساب مدرس بالفعل. ألغِ صلاحيته أولاً.":"تعذر تغيير الصلاحية.");await loadAccounts()}
  else{toast("تم تحديث صلاحية الحساب.");await loadAccounts()}
  s.disabled=false;
 }));
}
async function startExam(id){
 if(!sessionUser){setAuthMode("login");$("#authDialog").showModal();toast("سجّل الدخول أولاً لبدء الامتحان.");return}
 const {data:exam,error:ee}=await db.from("exams").select("id,title,description,duration_minutes,show_score,pass_percent").eq("id",id).eq("published",true).single();
 if(ee){console.error(ee);toast("تعذر فتح الامتحان.");return}
 const {data:qs,error:qe}=await db.rpc("get_exam_questions",{p_exam_id:id});
 if(qe){console.error(qe);toast("تعذر تحميل أسئلة الامتحان.");return}
 if(!qs?.length){toast("هذا الامتحان لا يحتوي على أسئلة بعد.");return}
 activeExam=exam;activeQuestions=qs;$("#takeExamTitle").textContent=exam.title;$("#takeExamMeta").textContent=exam.duration_minutes+" دقيقة · النجاح من "+exam.pass_percent+"%";
 $("#questionArea").innerHTML=qs.map((q,i)=>'<section class="exam-question"><h3>'+(i+1)+'. '+esc(q.prompt)+'</h3><div class="exam-options-list">'+(q.options||[]).map((o,j)=>'<label class="exam-option"><input type="radio" name="answer-'+q.id+'" value="'+j+'" required><span>'+esc(o)+'</span></label>').join("")+'</div></section>').join("");
 setStatus("#takeExamStatus","");$("#examDialog").showModal();
}
async function submitExam(event){
 event.preventDefault();if(!activeExam||!sessionUser)return;
 const answers={};
 for(const q of activeQuestions){const choice=$('input[name="answer-'+q.id+'"]:checked',$("#questionArea"));if(!choice){setStatus("#takeExamStatus","جاوب عن كل الأسئلة قبل التسليم.",true);return}answers[q.id]=Number(choice.value)}
 const b=$('button[type="submit"]',event.currentTarget);b.disabled=true;setStatus("#takeExamStatus","جارٍ تصحيح الإجابات وحفظ النتيجة...");
 const {data,error}=await db.rpc("submit_exam_attempt",{p_exam_id:activeExam.id,p_answers:answers});b.disabled=false;
 if(error){console.error(error);setStatus("#takeExamStatus",error.message?.includes("Retakes")?"هذه المحاولة غير متاحة لأن الامتحان يسمح بمحاولة واحدة فقط.":"تعذر تسليم الامتحان. حاول مرة أخرى.",true);return}
 const result=Array.isArray(data)?data[0]:data;
 const msg=result?.score==null?"تم تسليم الامتحان وحفظ المحاولة. النتيجة مخفية حسب إعداد المدرس.":"تم التصحيح بنجاح: "+result.score+" من "+result.max_score+".";
 setStatus("#takeExamStatus",msg);toast("تم حفظ إجابتك.");$("#examDialog").close();activeExam=null;activeQuestions=[];
 await Promise.all([loadAttempts(),loadExams()]);
}
async function submitAuth(event){
 event.preventDefault();const form=event.currentTarget,b=$(".auth-submit",form),v=new FormData(form);
 const email=String(v.get("email")||"").trim().toLowerCase(),password=String(v.get("password")||"");b.disabled=true;
 setStatus("#authStatus",authMode==="signup"?"جارٍ إنشاء الحساب...":"جارٍ تسجيل الدخول...");
 try{
  if(authMode==="signup"){
   const name=String(v.get("displayName")||"").trim()||"طالب";
   const {data,error}=await db.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:window.location.origin+window.location.pathname}});
   if(error)throw error;
   if(data.session){$("#authDialog").close();await refreshSession();toast("تم إنشاء الحساب بنجاح.")}
   else setStatus("#authStatus","تم إنشاء الحساب. افتح بريدك الإلكتروني واضغط رابط التأكيد، ثم ارجع وسجّل الدخول.");
  }else{
   const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;
   $("#authDialog").close();await refreshSession();toast("تم تسجيل الدخول.");
  }
 }catch(e){console.error(e);setStatus("#authStatus",e.message||"تعذر إكمال العملية.",true)}
 finally{b.disabled=false}
}
async function logout(){
 const {error}=await db.auth.signOut();if(error){console.error(error);toast("تعذر تسجيل الخروج.");return}
 sessionUser=null;profile=null;updateAuthUI();await loadExams();toast("تم تسجيل الخروج.");
}
async function submitAnnouncement(event){
 event.preventDefault();if(!isStaff()||!sessionUser)return;
 const f=event.currentTarget,v=new FormData(f),b=$('button[type="submit"]',f);b.disabled=true;
 const {error}=await db.from("announcements").insert({title:String(v.get("title")).trim(),body:String(v.get("body")).trim(),published:true,pinned:false,created_by:sessionUser.id});
 b.disabled=false;if(error){console.error(error);setStatus("#announcementStatus","تعذر نشر الإعلان.",true);return}
 f.reset();setStatus("#announcementStatus","تم نشر الإعلان بنجاح.");await loadAnnouncements();
}
async function submitResource(event){
 event.preventDefault();if(!isStaff()||!sessionUser)return;
 const f=event.currentTarget,v=new FormData(f),b=$('button[type="submit"]',f),url=String(v.get("url")||"").trim();
 let parsed;try{parsed=new URL(url)}catch{return setStatus("#resourceStatus","اكتب رابطًا صحيحًا يبدأ بـ https://",true)}
 if(!["https:","http:"].includes(parsed.protocol))return setStatus("#resourceStatus","نوع الرابط غير مسموح.",true);
 b.disabled=true;
 const {error}=await db.from("resources").insert({title:String(v.get("title")).trim(),description:String(v.get("description")||"").trim(),resource_url:url,resource_type:"link",published:true,created_by:sessionUser.id});
 b.disabled=false;if(error){console.error(error);setStatus("#resourceStatus","تعذر إضافة المصدر.",true);return}
 f.reset();setStatus("#resourceStatus","تمت إضافة المصدر للمكتبة.");await loadResources();
}
function bindEvents(){
 $("#year").textContent=new Date().getFullYear();
 $("#authOpen").addEventListener("click",()=>{setAuthMode("login");$("#authDialog").showModal()});
 $("#authClose").addEventListener("click",()=>$("#authDialog").close());
 $("#examClose").addEventListener("click",()=>$("#examDialog").close());
 $$("[data-mode]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.mode)));
 $("#authForm").addEventListener("submit",submitAuth);$("#logoutBtn").addEventListener("click",logout);
 $("#examForm").addEventListener("submit",saveExam);$("#announcementForm").addEventListener("submit",submitAnnouncement);
 $("#resourceForm").addEventListener("submit",submitResource);$("#takeExamForm").addEventListener("submit",submitExam);
 $("#addQuestionBtn").addEventListener("click",addQuestion);
 $("#dangerUnlockBtn").addEventListener("click",()=>{if(!isOwner())return toast("هذه المنطقة لمالك المنصة فقط.");if(!dangerUnlocked){if(!window.confirm("تنبيه: أنت على وشك فتح منطقة الإدارة الحساسة. هل تريد المتابعة؟"))return;dangerUnlocked=true;$("#dangerContent").hidden=false;$("#dangerUnlockBtn").textContent="قفل أدوات الطوارئ";}else{dangerUnlocked=false;$("#dangerContent").hidden=true;$("#dangerUnlockBtn").textContent="فتح أدوات الطوارئ";}});
 $("#questionBuilder").addEventListener("click",e=>{const b=e.target.closest("[data-remove-question]");if(b){b.closest(".question-card").remove();renumberQuestions()}});
 $("#menuBtn").addEventListener("click",()=>$("#mainNav").classList.toggle("open"));
 $("#mainNav").addEventListener("click",e=>{if(e.target.closest("a"))$("#mainNav").classList.remove("open")});
 $("#authDialog").addEventListener("click",e=>{if(e.target===$("#authDialog"))$("#authDialog").close()});
 $("#examDialog").addEventListener("click",e=>{if(e.target===$("#examDialog"))$("#examDialog").close()});
}
document.addEventListener("DOMContentLoaded",async()=>{
 bindEvents();addQuestion();setAuthMode("login");await refreshSession();
 db.auth.onAuthStateChange((_event,session)=>{
  sessionUser=session?.user||null;
  window.setTimeout(async()=>{await loadProfile();updateAuthUI();await Promise.all([loadExams(),loadResources(),loadAnnouncements()]);},0);
 });
});
