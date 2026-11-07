/* Seal X2 — secure client. Public publishable key only. */
const SUPABASE_URL="https://hftmfcfaikjkepawppvv.supabase.co";
const SUPABASE_KEY="sb_publishable_kmhzdsmzZjVAG4pAgwj7gg_GovehO0i";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let sessionUser=null,profile=null,authMode="login",activeExam=null,activeQuestions=[];
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateLabel=v=>new Date(v).toLocaleDateString("ar-EG",{year:"numeric",month:"short",day:"numeric"});
const staff=()=>["teacher","admin","owner"].includes(profile?.role);
const owner=()=>["admin","owner"].includes(profile?.role);
function toast(m){const e=$("#toast");e.textContent=m;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2800)}
function status(id,m){const e=$(id);if(e)e.textContent=m}
function setAuthMode(mode){authMode=mode;$$("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));$("#displayNameWrap").hidden=mode!=="signup";$("#authTitle").textContent=mode==="signup"?"إنشاء حساب طالب":"تسجيل الدخول";$("#authDescription").textContent=mode==="signup"?"الحساب الجديد يحصل تلقائيًا على صلاحية طالب.":"أدخل بريدك الإلكتروني وكلمة المرور للمتابعة."}
async function loadProfile(){profile=null;if(!sessionUser)return;const {data,error}=await db.from("profiles").select("display_name,role").eq("id",sessionUser.id).single();if(error){console.error(error);return}profile=data}
function updateAuthUI(){
 const logged=!!sessionUser;$("#authOpen").hidden=logged;$("#logoutBtn").hidden=!logged;$("#userBadge").hidden=!logged;
 $("#userBadge").textContent=profile?.role==="owner"?"إدارة المنصة":profile?.display_name||sessionUser?.email||"";
 $("#dashboard").hidden=!logged;$("#teacherPanel").hidden=!staff();
 if(logged)loadAttempts();if(staff()){loadSubjects();loadStaffExams()} $("#ownerTools").hidden=profile?.role!=="owner";if(profile?.role==="owner")loadAccounts();
 if($("#roleLabel"))$("#roleLabel").textContent=profile?.role==="owner"?"OWNER CONTROL":profile?.role==="admin"?"ADMIN WORKSPACE":profile?.role==="teacher"?"TEACHER WORKSPACE":"STAFF";
}
async function refreshSession(){const {data}=await db.auth.getSession();sessionUser=data.session?.user||null;await loadProfile();updateAuthUI()}
async function loadExams(){
 const target=$("#examGrid");const {data,error}=await db.from("exams").select("id,title,description,duration_minutes,created_at,allow_retake,show_score,pass_percent,shuffle_questions,subjects(name)").eq("published",true).order("created_at",{ascending:false});
 if(error){target.innerHTML='<div class="loading-card">تعذر تحميل الامتحانات حالياً.</div>';console.error(error);return}
 if(!data.length){target.innerHTML='<div class="loading-card">لا توجد امتحانات منشورة حالياً. ستظهر هنا عند نشر أول امتحان.</div>';return}
 let attempts=[];if(sessionUser){const a=await db.from("exam_attempts").select("exam_id").eq("student_id",sessionUser.id);attempts=a.data||[]}
 const done=new Set(attempts.map(a=>a.exam_id));
 target.innerHTML=data.map(e=>{const blocked=!e.allow_retake&&done.has(e.id);return '<article class="content-card"><span class="card-icon">✎</span><h3>'+esc(e.title)+'</h3><p>'+esc(e.description||"اختبار علوم متكامل")+'</p><div class="student-exam-meta"><span class="exam-pill">'+esc(e.subjects?.name||"العلوم المتكاملة")+'</span><span>'+e.duration_minutes+' دقيقة</span><span>'+e.pass_percent+'% للنجاح</span></div><div class="card-foot"><span>'+(blocked?"تمت المحاولة":"اختيار من متعدد")+'</span><button '+(blocked?'disabled':'')+' data-start-exam="'+e.id+'">'+(blocked?"غير متاح":"ابدأ الامتحان ↗")+'</button></div></article>'}).join("");
 $$("[data-start-exam]").forEach(b=>b.addEventListener("click",()=>startExam(b.dataset.startExam)));
}
async function loadResources(){const t=$("#resourceGrid"),{data,error}=await db.from("resources").select("*").eq("published",true).order("created_at",{ascending:false});if(error){t.innerHTML='<div class="loading-card">تعذر تحميل المصادر.</div>';return}if(!data.length){t.innerHTML='<div class="loading-card">سيتم إضافة المصادر التعليمية هنا.</div>';return}t.innerHTML=data.map(r=>'<article class="content-card"><span class="card-icon">▤</span><h3>'+esc(r.title)+'</h3><p>'+esc(r.description)+'</p><div class="card-foot"><span>مصدر تعليمي</span><a href="'+esc(r.resource_url)+'" target="_blank" rel="noopener noreferrer">فتح المصدر ↗</a></div></article>').join("")}
async function loadAnnouncements(){const t=$("#announcementList"),{data,error}=await db.from("announcements").select("*").eq("published",true).order("pinned",{ascending:false}).order("created_at",{ascending:false});if(error){t.innerHTML='<div class="loading-card">تعذر تحميل الإعلانات.</div>';return}if(!data.length){t.innerHTML='<div class="loading-card">لا توجد إعلانات حالياً.</div>';return}t.innerHTML=data.map(a=>'<article class="announcement-item"><small>'+(a.pinned?"✦ إعلان مهم · ":"")+dateLabel(a.created_at)+'</small><h3>'+esc(a.title)+'</h3><p>'+esc(a.body)+'</p></article>').join("")}
async function loadAttempts(){const {data,error}=await db.from("exam_attempts").select("id,exam_id,score,max_score,submitted_at,exams(title)").eq("student_id",sessionUser.id).order("submitted_at",{ascending:false}).limit(50);const t=$("#attemptList");if(error){t.textContent="تعذر تحميل النتائج.";return}t.innerHTML=data.length?data.map(a=>'<div class="attempt-item"><span>'+esc(a.exams?.title||"امتحان")+'<br><small>'+dateLabel(a.submitted_at)+'</small></span><b>'+a.score+' / '+a.max_score+'</b></div>').join(""):'<div class="loading-card">ستظهر نتائجك هنا بعد حل أول امتحان.</div>'}
async function loadSubjects(){const {data,error}=await db.from("subjects").select("id,name").eq("name","العلوم المتكاملة").order("name");if(error)return;$("#subjectSelect").innerHTML=data.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join("")}
function addQuestion(){
 const index=$$(".question-builder").length+1,box=document.createElement("div");box.className="question-builder";
 box.innerHTML='<div class="question-builder-top"><b>السؤال '+index+'</b><button type="button" class="remove-question">حذف السؤال</button></div><label>نص السؤال<textarea class="q-prompt" rows="2" maxlength="1000" required placeholder="اكتب السؤال بوضوح..."></textarea></label><div class="choice-grid">'+[0,1,2,3].map((n)=>'<label class="choice-input"><input type="radio" class="q-correct" name="correct_'+(Date.now()+"_"+Math.random().toString(36).slice(2))+'" value="'+n+'" '+(n===0?'checked':'')+'><input type="text" class="q-option" maxlength="300" required placeholder="الاختيار '+(n+1)+'"></label>').join("")+'</div><label>درجة السؤال<input class="q-points points-input" type="number" min="1" max="100" value="1" required></label>';
 box.querySelector(".remove-question").addEventListener("click",()=>{if($$(".question-builder").length===1){toast("يجب أن يحتوي الامتحان على سؤال واحد على الأقل.");return}box.remove();renumberQuestions()});
 $("#questionBuilder").append(box);renumberQuestions();
}
function renumberQuestions(){$$(".question-builder").forEach((q,i)=>q.querySelector(".question-builder-top b").textContent="السؤال "+(i+1))}
async function loadAccounts(){
 const t=$("#accountList");if(!t)return;
 const {data,error}=await db.from("profiles").select("id,display_name,role,created_at").order("created_at",{ascending:false}).limit(100);
 if(error){t.textContent="تعذر تحميل الحسابات.";return}
 t.innerHTML=data.map(p=>'<div class="staff-exam-row"><span><b>'+esc(p.display_name||"بدون اسم")+'</b><br><small>'+esc(p.id)+' · '+esc(p.role)+'</small></span><span><select data-role-user="'+p.id+'"><option value="student" '+(p.role==="student"?"selected":"")+'>طالب</option><option value="teacher" '+(p.role==="teacher"?"selected":"")+'>مدرس</option><option value="admin" '+(p.role==="admin"?"selected":"")+'>مدير</option></select><button data-save-role="'+p.id+'">حفظ الصلاحية</button></span></div>').join("");
 $("[data-save-role]").forEach(b=>b.addEventListener("click",async()=>{const role=$('[data-role-user="'+b.dataset.saveRole+'"]').value;if(!confirm("تأكيد تغيير الصلاحية إلى "+role+"؟"))return;const {error}=await db.rpc("owner_set_role",{p_user_id:b.dataset.saveRole,p_role:role});if(error){toast("تعذر تغيير الصلاحية: "+error.message);return}toast("تم تحديث الصلاحية.");loadAccounts()}));
}
async function loadStaffExams(){
 const t=$("#staffExamList");if(!t)return;const {data,error}=await db.from("exams").select("id,title,published,created_at").order("created_at",{ascending:false}).limit(30);
 if(error){t.textContent="تعذر تحميل قائمة الامتحانات.";return}if(!data.length){t.innerHTML='<p class="hint">لم يتم إنشاء امتحانات بعد.</p>';return}
 t.innerHTML=data.map(e=>'<div class="staff-exam-row"><span><b>'+esc(e.title)+'</b><br><small>'+(e.published?"منشور":"مسودة")+' · '+dateLabel(e.created_at)+'</small></span><span><button data-toggle-exam="'+e.id+'" data-published="'+e.published+'">'+(e.published?"إخفاء":"نشر")+'</button> '+(owner()?'<button data-delete-exam="'+e.id+'">حذف</button>':"")+'</span></div>').join("");
 $$("[data-toggle-exam]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await db.from("exams").update({published:b.dataset.published!=="true"}).eq("id",b.dataset.toggleExam);if(error)toast("تعذر تحديث حالة الامتحان.");else{toast("تم تحديث حالة الامتحان.");loadStaffExams();loadExams()}}));
 $$("[data-delete-exam]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("هل تريد حذف هذا الامتحان وأسئلته نهائيًا؟"))return;const {error}=await db.from("exams").delete().eq("id",b.dataset.deleteExam);if(error)toast("تعذر الحذف: "+error.message);else{toast("تم حذف الامتحان.");loadStaffExams();loadExams()}}));
}
async function startExam(id){
 if(!sessionUser){$("#authDialog").showModal();toast("سجّل الدخول أولاً.");return}
 const {data:exam,error}=await db.from("exams").select("id,title,duration_minutes,description,allow_retake,show_score,pass_percent").eq("id",id).single();if(error){toast("تعذر فتح الامتحان.");return}
 if(!exam.allow_retake){const old=await db.from("exam_attempts").select("id").eq("exam_id",id).eq("student_id",sessionUser.id).limit(1);if(old.data?.length){toast("هذا الامتحان يسمح بمحاولة واحدة فقط.");return}}
 const {data:questions,error:qError}=await db.rpc("get_exam_questions",{p_exam_id:id});if(qError||!questions?.length){toast("لا توجد أسئلة متاحة.");return}
 activeExam=exam;activeQuestions=questions;$("#takeExamTitle").textContent=exam.title;$("#takeExamMeta").textContent=exam.duration_minutes+" دقيقة · "+questions.length+" أسئلة · كلها اختيار من متعدد";
 $("#questionArea").innerHTML='<div class="exam-instructions">'+esc(exam.description||"اقرأ كل سؤال واختر إجابة واحدة. تأكد من إجاباتك قبل التسليم.")+'</div><div class="question-progress"><span id="answerProgress" style="width:0%"></span></div>'+questions.map((q,i)=>'<div class="question-block"><h3>'+(i+1)+'. '+esc(q.prompt)+' <small>('+q.points+' درجات)</small></h3>'+q.options.map((o,j)=>'<label class="option-row"><input type="radio" name="q_'+q.id+'" value="'+j+'" required> '+esc(o)+'</label>').join("")+'</div>').join("");
 $$('#questionArea input[type=radio]').forEach(r=>r.addEventListener("change",()=>{const count=new Set($$('#questionArea input:checked').map(x=>x.name)).size;$("#answerProgress").style.width=(count/questions.length*100)+"%"}));
 status("#takeExamStatus","");$("#examDialog").showModal();
}
$("#takeExamForm").addEventListener("submit",async e=>{e.preventDefault();if(!activeExam)return;const answers={};for(const q of activeQuestions){const c=$('input[name="q_'+q.id+'"]:checked');if(!c){status("#takeExamStatus","أجب عن جميع الأسئلة قبل التسليم.");return}answers[q.id]=Number(c.value)}
 const b=e.submitter;b.disabled=true;status("#takeExamStatus","جاري تصحيح إجاباتك وحفظ النتيجة...");const {data,error}=await db.rpc("submit_exam_attempt",{p_exam_id:activeExam.id,p_answers:answers});b.disabled=false;if(error){status("#takeExamStatus","تعذر التسليم: "+error.message);return}
 const result=data?.[0];if(activeExam.show_score){const pct=Math.round(result.score/result.max_score*100);status("#takeExamStatus","نتيجتك "+result.score+" من "+result.max_score+" ("+pct+"%) · "+(pct>=activeExam.pass_percent?"اجتزت الامتحان":"تحتاج إلى مراجعة أكثر"));}else status("#takeExamStatus","تم تسليم إجاباتك وحفظ المحاولة. النتيجة غير معروضة حسب إعداد الامتحان.");
 await loadAttempts();await loadExams();setTimeout(()=>$("#examDialog").close(),2300);
});
$("#authOpen").addEventListener("click",()=>{$("#authDialog").showModal();setAuthMode("login")});$("#authClose").addEventListener("click",()=>$("#authDialog").close());$("#examClose").addEventListener("click",()=>$("#examDialog").close());$$("[data-mode]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.mode)));
$("#authForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,email=f.elements.email.value.trim(),password=f.elements.password.value;status("#authStatus","جاري تنفيذ الطلب...");let result;
 if(authMode==="signup"){result=await db.auth.signUp({email,password,options:{data:{display_name:f.elements.displayName.value.trim()||"طالب"}}});if(!result.error&&!result.data.session)status("#authStatus","تم إنشاء الحساب. راجع بريدك لتأكيده ثم سجّل الدخول.");}
 else result=await db.auth.signInWithPassword({email,password});
 if(result.error){status("#authStatus",result.error.message);return}if(result.data.session){$("#authDialog").close();await refreshSession();await loadExams();toast("تم تسجيل الدخول بنجاح.");}else if(authMode==="signup")status("#authStatus","راجع بريدك الإلكتروني لتأكيد الحساب.");
});
$("#logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();sessionUser=null;profile=null;updateAuthUI();toast("تم تسجيل الخروج.")});
$("#examForm").addEventListener("submit",async e=>{
 e.preventDefault();const f=e.currentTarget,questions=$$(".question-builder");if(!questions.length){status("#examStatus","أضف سؤالاً واحداً على الأقل.");return}
 const parsed=[];for(let i=0;i<questions.length;i++){const q=questions[i],prompt=q.querySelector(".q-prompt").value.trim(),options=$$(".q-option",q).map(x=>x.value.trim()),correct=q.querySelector(".q-correct:checked"),points=Number(q.querySelector(".q-points").value);
 if(!prompt||options.some(x=>!x)||new Set(options).size!==options.length||!correct||!Number.isInteger(points)||points<1||points>100){status("#examStatus","راجع السؤال "+(i+1)+": اكتب السؤال وكل الاختيارات وحدد الإجابة الصحيحة ودرجة صالحة.");return}
 parsed.push({prompt,options,correct_option:Number(correct.value),points,sort_order:i});
 }
 status("#examStatus","جاري حفظ الامتحان والأسئلة...");const {data:exam,error}=await db.from("exams").insert({title:f.elements.title.value.trim(),description:f.elements.description.value.trim(),subject_id:f.elements.subject.value,duration_minutes:Number(f.elements.duration.value),pass_percent:Number(f.elements.passPercent.value),shuffle_questions:f.elements.shuffle.checked,allow_retake:f.elements.retake.checked,show_score:f.elements.showScore.checked,published:f.elements.published.checked,created_by:sessionUser.id}).select("id").single();
 if(error){status("#examStatus",error.message);return}const rows=parsed.map(q=>({...q,exam_id:exam.id}));const {error:qError}=await db.from("exam_questions").insert(rows);
 if(qError){await db.from("exams").delete().eq("id",exam.id);status("#examStatus","تعذر حفظ الأسئلة: "+qError.message);return}
 f.reset();$("#questionBuilder").innerHTML="";addQuestion();addQuestion();f.elements.duration.value=30;f.elements.passPercent.value=50;f.elements.retake.checked=true;f.elements.showScore.checked=true;status("#examStatus","تم إنشاء الامتحان بنجاح وحفظ "+rows.length+" أسئلة.");loadExams();loadStaffExams();
});
$("#announcementForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,{error}=await db.from("announcements").insert({title:f.elements.title.value.trim(),body:f.elements.body.value.trim(),created_by:sessionUser.id});status("#announcementStatus",error?error.message:"تم نشر الإعلان.");if(!error){f.reset();loadAnnouncements()}});
$("#resourceForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,{error}=await db.from("resources").insert({title:f.elements.title.value.trim(),description:f.elements.description.value.trim(),resource_url:f.elements.url.value.trim(),created_by:sessionUser.id});status("#resourceStatus",error?error.message:"تمت إضافة المصدر.");if(!error){f.reset();loadResources()}});
$("#addQuestionBtn").addEventListener("click",addQuestion);$("#menuBtn").addEventListener("click",()=>$("#mainNav").classList.toggle("open"));$("#mainNav").addEventListener("click",e=>{if(e.target.closest("a"))$("#mainNav").classList.remove("open")});$("#year").textContent=new Date().getFullYear();
db.auth.onAuthStateChange((_event,session)=>{sessionUser=session?.user||null;setTimeout(async()=>{await loadProfile();updateAuthUI();await loadExams()},0)});
(async()=>{addQuestion();addQuestion();await Promise.all([loadExams(),loadResources(),loadAnnouncements()]);await refreshSession()})();
