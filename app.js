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
 $("#authDescription").textContent=mode==="signup"?"اختر اسم مستخدم وكلمة مرور. الحساب ينتظر موافقة المدرس.":"أدخل اسم المستخدم وكلمة المرور للمتابعة.";
 $("#authForm .auth-submit").textContent=mode==="signup"?"إنشاء الحساب":"تسجيل الدخول";
}
async function loadProfile(){
 profile=null;if(!sessionUser)return;
 const {data,error}=await db.from("profiles").select("display_name,full_name,role,is_approved,username").eq("id",sessionUser.id).maybeSingle();
 if(error){console.error("Profile:",error);return} profile=data;
}
function updateAuthUI(){
 const logged=!!sessionUser, pending=logged&&profile?.is_approved===false;
 $("#authOpen").hidden=logged;$("#logoutBtn").hidden=!logged;$("#userBadge").hidden=!logged;
 $("#approvalGate").hidden=!pending;$("#metrics").hidden=pending;
 $("#exams").hidden=pending;$("#library").hidden=pending;$("#announcements").hidden=pending;
 $("#dashboard").hidden=!logged||pending;$("#teacherPanel").hidden=!isStaff()||pending;
 $("#userBadge").textContent=profile?.display_name||profile?.username||"حساب المستخدم";
 $("#ownerTools").hidden=!isOwner();
 if(!isOwner()){dangerUnlocked=false;$("#dangerContent").hidden=true;$("#dangerUnlockBtn").textContent="فتح أدوات الطوارئ";}
 if(logged&&!pending){loadAttempts();loadStudentReports();}
 if(isStaff()&&!pending){loadSubjects();loadStaffExams();loadPendingApprovals();if(sessionUser?.id==="5d0f01fe-d999-42e8-bb49-0b87a308e138")loadTeacherReports();}
 if(isOwner()&&!pending)loadAccounts();
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
function reportDate(v){return new Date(v).toLocaleString("ar-EG",{dateStyle:"medium",timeStyle:"short"})}
function reportWrongHtml(items){
 if(!Array.isArray(items)||!items.length)return '<p class="report-perfect">ممتاز! لم توجد إجابات خاطئة في هذه المحاولة.</p>';
 return '<div class="report-wrong-list">'+items.map((q,i)=>'<article class="report-wrong"><b>السؤال '+(i+1)+'</b><p>'+esc(q.prompt)+'</p><div class="report-answer bad-answer"><small>إجابتك</small><strong>'+esc(q.selected_option||"لم تتم الإجابة")+'</strong></div><div class="report-answer good-answer"><small>الإجابة الصحيحة</small><strong>'+esc(q.correct_option||"")+'</strong></div><small class="report-points">درجة السؤال: '+esc(q.points)+'</small></article>').join("")+'</div>';
}
async function loadStudentReports(){
 const host=$("#studentReportList");if(!host||!sessionUser)return;
 const {data,error}=await db.from("exam_reports").select("id,exam_title,score,max_score,wrong_questions,student_can_view_score,submitted_at").eq("student_id",sessionUser.id).order("submitted_at",{ascending:false}).limit(100);
 if(error){console.error("Student reports:",error);host.innerHTML='<div class="empty-state">تعذر تحميل تقاريرك حاليًا.</div>';return}
 if(!data?.length){host.innerHTML='<div class="empty-state">ستظهر تقاريرك هنا تلقائيًا بعد تسليم أول امتحان.</div>';return}
 host.innerHTML=data.map(r=>'<article class="report-card"><div class="report-card-head"><div><span class="report-kicker">EXAM REPORT</span><h3>'+esc(r.exam_title)+'</h3><small>'+reportDate(r.submitted_at)+'</small></div><div class="report-score">'+(r.student_can_view_score?'<b>'+r.score+' / '+r.max_score+'</b>':'<b>محفوظ</b>')+'<small>'+(r.student_can_view_score?'الدرجة':'النتيجة مخفية')+'</small></div></div>'+(r.student_can_view_score?'<details class="report-details"><summary>مراجعة الإجابات الخاطئة ('+(Array.isArray(r.wrong_questions)?r.wrong_questions.length:0)+')</summary>'+reportWrongHtml(r.wrong_questions)+'</details>':'<p class="hint">تم حفظ التقرير. تفاصيل التصحيح تخضع لإعدادات المدرس.</p>')+'</article>').join("");
}
async function loadTeacherReports(){
 const host=$("#teacherReportList");if(!host||sessionUser?.id!=="5d0f01fe-d999-42e8-bb49-0b87a308e138")return;
 const {data,error}=await db.from("exam_reports").select("id,student_name,exam_title,score,max_score,wrong_questions,submitted_at").eq("teacher_id",sessionUser.id).order("submitted_at",{ascending:false}).limit(250);
 if(error){console.error("Teacher reports:",error);host.innerHTML='<div class="empty-state">تعذر تحميل التقارير. تحقق من صلاحيات قاعدة البيانات.</div>';return}
 if(!data?.length){host.innerHTML='<div class="empty-state">لا توجد تقارير بعد. ستصل تقارير الطلاب هنا تلقائيًا فور تسليم الامتحانات.</div>';return}
 host.innerHTML=data.map(r=>'<article class="report-card teacher-report"><div class="report-card-head"><div><span class="report-kicker">PRIVATE STUDENT REPORT</span><h3>'+esc(r.student_name)+'</h3><p>'+esc(r.exam_title)+'</p><small>'+reportDate(r.submitted_at)+'</small></div><div class="report-score"><b>'+r.score+' / '+r.max_score+'</b><small>الدرجة</small></div></div><details class="report-details"><summary>الأسئلة التي أخطأ فيها ('+(Array.isArray(r.wrong_questions)?r.wrong_questions.length:0)+')</summary>'+reportWrongHtml(r.wrong_questions)+'</details></article>').join("");
}
async function loadSubjects(){
 const s=$("#subjectSelect"),{data,error}=await db.from("subjects").select("id,name").order("name");
 if(error){console.error(error);s.innerHTML='<option value="">تعذر تحميل المواد</option>';return}
 const rows=(data||[]).filter(x=>x.name==="العلوم المتكاملة");
 s.innerHTML=rows.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")||'<option value="">مادة العلوم المتكاملة غير موجودة</option>';
}
function parseJsLiteral(source,start){
 let i=start;
 const skip=()=>{while(i<source.length){if(/\s/.test(source[i])){i++;continue}if(source.slice(i,i+2)==="//"){i=source.indexOf("\n",i+2);if(i<0)i=source.length;continue}if(source.slice(i,i+2)==="/*"){const end=source.indexOf("*/",i+2);if(end<0)throw new Error("تعليق JavaScript غير مكتمل.");i=end+2;continue}break}};
 const string=()=>{const quote=source[i++];let out="";while(i<source.length){let c=source[i++];if(c===quote)return out;if(c==="\\"){if(i>=source.length)break;const e=source[i++];const map={n:"\n",r:"\r",t:"\t",b:"\b",f:"\f",v:"\v","0":"\0"};if(e==="u"){const h=source.slice(i,i+4);if(!/^[0-9a-f]{4}$/i.test(h))throw new Error("ترميز Unicode غير صحيح داخل نص.");out+=String.fromCharCode(parseInt(h,16));i+=4}else if(e==="x"){const h=source.slice(i,i+2);if(!/^[0-9a-f]{2}$/i.test(h))throw new Error("ترميز نص غير صحيح.");out+=String.fromCharCode(parseInt(h,16));i+=2}else if(e==="\n"){}else out+=map[e]??e}else out+=c}throw new Error("هناك نص غير مغلق بعلامة اقتباس.")};
 const value=()=>{
  skip();const c=source[i];
  if(c==="'"||c==='"')return string();
  if(c==="["){i++;const a=[];skip();if(source[i]==="]"){i++;return a}while(i<source.length){a.push(value());skip();if(source[i]==="]"){i++;return a}if(source[i]!==",")throw new Error("تنسيق عناصر مصفوفة الأسئلة غير صحيح.");i++;skip();if(source[i]==="]"){i++;return a}}throw new Error("مصفوفة الأسئلة غير مكتملة.")}
  if(c==="{"){i++;const o={};skip();if(source[i]==="}"){i++;return o}while(i<source.length){skip();let k;if(source[i]==="'"||source[i]==='"')k=string();else{const m=source.slice(i).match(/^[A-Za-z_$][\w$]*/);if(!m)throw new Error("اسم خاصية غير صحيح في كائن السؤال.");k=m[0];i+=k.length}skip();if(source[i++]!==":")throw new Error("علامة النقطتين مفقودة بعد "+k+".");o[k]=value();skip();if(source[i]==="}"){i++;return o}if(source[i]!==",")throw new Error("تنسيق خصائص السؤال غير صحيح.");i++;skip();if(source[i]==="}"){i++;return o}}throw new Error("كائن السؤال غير مكتمل.")}
  const num=source.slice(i).match(/^-?\d+(?:\.\d+)?/);if(num){i+=num[0].length;return Number(num[0])}
  const id=source.slice(i).match(/^[A-Za-z_$][\w$]*/);if(id){i+=id[0].length;if(id[0]==="true")return true;if(id[0]==="false")return false;if(id[0]==="null")return null;throw new Error("قيمة JavaScript غير مدعومة: "+id[0])}
  throw new Error("تعذر فهم بيانات الأسئلة قرب الموضع "+i+".");
 };
 const result=value();return result;
}
function readExamSource(source){
 if(!source.trim())throw new Error("الصق كود ملف الامتحان أولاً.");
 const doc=new DOMParser().parseFromString(source,"text/html");
 const scripts=[...doc.querySelectorAll("script")].map(s=>s.textContent||"");
 const jsSource=scripts.join("\n")||source;
 const match=jsSource.match(/\b(?:const|let|var)\s+questions\s*=\s*/);
 if(!match)throw new Error("لم أجد مصفوفة questions داخل الكود. يجب أن تكون بصيغة const questions = [ ... ].");
 const questions=parseJsLiteral(jsSource,match.index+match[0].length);
 if(!Array.isArray(questions)||!questions.length)throw new Error("مصفوفة الأسئلة فارغة أو ليست مصفوفة صحيحة.");
 if(questions.length>200)throw new Error("الحد الأقصى للاستيراد هو 200 سؤال في الامتحان الواحد.");
 const normalized=questions.map((q,i)=>{
  if(!q||typeof q!=="object"||Array.isArray(q))throw new Error("السؤال رقم "+(i+1)+" ليس كائن سؤال صحيحًا.");
  const prompt=String(q.q??q.prompt??"").trim(),options=q.opts??q.options,correct=Number(q.ans??q.correct_option);
  if(!prompt)throw new Error("نص السؤال رقم "+(i+1)+" غير موجود.");
  if(!Array.isArray(options)||options.length!==4||options.some(x=>typeof x!=="string"||!x.trim()))throw new Error("السؤال رقم "+(i+1)+" يجب أن يحتوي على أربعة اختيارات نصية غير فارغة بالضبط.");
  if(!Number.isInteger(correct)||correct<0||correct>=options.length)throw new Error("رقم الإجابة الصحيحة في السؤال رقم "+(i+1)+" غير صحيح. استخدم ترقيمًا يبدأ من صفر.");
  return {prompt,options:options.map(x=>x.trim()),correct_option:correct,points:Number(q.points??1)};
 });
 if(normalized.some(q=>!Number.isInteger(q.points)||q.points<1||q.points>100))throw new Error("درجة كل سؤال يجب أن تكون عددًا صحيحًا من 1 إلى 100.");
 const title=(doc.querySelector("title")?.textContent||"").trim();
 const lesson=(doc.querySelector(".timer-box span")?.textContent||doc.querySelector("header p")?.textContent||"").trim();
 const timeMatch=jsSource.match(/\btimeLeft\s*=\s*(\d+)\s*;/);
 const duration=timeMatch?Math.round(Number(timeMatch[1])/60):null;
 return {title,description:lesson,duration:duration&&duration>=5&&duration<=180?duration:null,questions:normalized};
}
function importExamCode(){
 const status=$("#importStatus"),preview=$("#importPreview");
 try{
  const parsed=readExamSource($("#examSourceCode").value);
  const existingCards=$$(".question-card",$("#questionBuilder"));
  const hasEnteredData=existingCards.some(card=>$(".question-prompt",card).value.trim()||$$(".question-option",card).some(input=>input.value.trim()));
  if(hasEnteredData&&!window.confirm("سيتم استبدال الأسئلة الموجودة حاليًا بالأسئلة المستوردة. هل تريد المتابعة؟"))return;
  if(parsed.title)$("#examForm [name=title]").value=parsed.title.slice(0,140);
  if(parsed.description)$("#examForm [name=description]").value=parsed.description.slice(0,500);
  if(parsed.duration)$("#examForm [name=duration]").value=parsed.duration;
  const subject=$("#subjectSelect");if(subject.options.length&&![...subject.options].some(o=>o.selected))subject.selectedIndex=0;
  $("#questionBuilder").innerHTML="";
  parsed.questions.forEach((q,i)=>{
   const card=addQuestion();
   $(".question-prompt",card).value=q.prompt;
   $$(".question-option",card).forEach((input,j)=>{if(j<q.options.length)input.value=q.options[j];else input.closest("label").hidden=true});
   $(".question-correct",card).innerHTML=q.options.map((_,j)=>'<option value="'+j+'">الاختيار '+(j+1)+'</option>').join("");
   $(".question-correct",card).value=String(q.correct_option);
   $(".question-points",card).value=String(q.points);
  });
  preview.hidden=false;preview.innerHTML='<b>تمت قراءة '+parsed.questions.length+' سؤالًا بنجاح.</b><span>العنوان: '+esc(parsed.title||"لم يُستخرج — اكتب العنوان يدويًا")+'</span><span>المدة: '+(parsed.duration?parsed.duration+" دقيقة":"لم تُستخرج — راجعها يدويًا")+'</span><span>الإجابة الصحيحة: تم نقلها من ans / correct_option لكل سؤال.</span><small>راجع المعاينة والأسئلة والإجابات قبل الحفظ أو النشر.</small>';
  setStatus("#importStatus","تم تحليل الكود وملء منشئ الامتحان. لم يتم حفظ أو نشر الامتحان بعد.");
  toast("تم استيراد الأسئلة إلى المنشئ.");
 }catch(e){preview.hidden=true;setStatus("#importStatus",e.message||"تعذر قراءة الكود.",true)}
}
function addQuestion(){
 const host=$("#questionBuilder"),n=host.querySelectorAll(".question-card").length+1,card=document.createElement("section");
 card.className="question-card";
 card.innerHTML='<div class="question-card-head"><b>السؤال '+n+'</b><button type="button" class="btn btn-outline btn-small" data-remove-question>حذف</button></div><label>نص السؤال<textarea class="question-prompt" rows="2" maxlength="1200" required placeholder="اكتب السؤال هنا"></textarea></label><div class="options-grid">'+[0,1,2,3].map((x)=>'<label>الاختيار '+(x+1)+'<input class="question-option" maxlength="300" required placeholder="اكتب الاختيار"></label>').join("")+'</div><div class="settings-grid"><label>الإجابة الصحيحة<select class="question-correct"><option value="0">الاختيار الأول</option><option value="1">الاختيار الثاني</option><option value="2">الاختيار الثالث</option><option value="3">الاختيار الرابع</option></select></label><label>درجة السؤال<input class="question-points" type="number" min="1" max="100" value="1" required></label></div>';
 host.appendChild(card);renumberQuestions();return card;
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

async function loadPendingApprovals(){
 const t=$("#pendingApprovalList");if(!t||!isStaff())return;
 const {data,error}=await db.from("profiles").select("id,display_name,username,role,created_at,is_approved").eq("is_approved",false).eq("role","student").order("created_at",{ascending:true}).limit(100);
 if(error){console.error(error);t.textContent="تعذر تحميل طلبات الانضمام.";return}
 if(!data?.length){t.innerHTML='<div class="empty-state">لا توجد حسابات في انتظار الموافقة حالياً.</div>';return}
 t.innerHTML=data.map(a=>'<div class="staff-row account-row"><span><b>'+esc(a.display_name||"طالب")+'</b><small>@'+esc(a.username||"بدون اسم مستخدم")+' · '+dateLabel(a.created_at)+'</small></span><button type="button" class="btn btn-primary btn-small" data-approve-user="'+a.id+'">قبول الطالب</button></div>').join("");
 $$("[data-approve-user]").forEach(b=>b.addEventListener("click",async()=>{
  if(!window.confirm("تأكيد قبول هذا الطالب ومنحه صلاحية استخدام المنصة؟"))return;
  b.disabled=true;
  const {error}=await db.rpc("staff_approve_user",{p_user_id:b.dataset.approveUser});
  if(error){console.error(error);toast("تعذر قبول الحساب.");b.disabled=false;return}
  toast("تم قبول الطالب وتفعيل حسابه.");await loadPendingApprovals();
 }));
}

async function loadAccounts(){
 const t=$("#accountList");if(!t||!isOwner()||!dangerUnlocked)return;
 t.innerHTML='<div class="empty-state">جارٍ تحميل الحسابات...</div>';
 const {data,error}=await db.functions.invoke("owner-user-admin",{body:{action:"list_accounts"}});
 if(error||!data?.accounts){console.error(error);t.innerHTML='<div class="empty-state">تعذر تحميل الحسابات. تحقق من اتصالك ثم أعد المحاولة.</div>';return}
 const accounts=data.accounts;
 if(!accounts.length){t.innerHTML='<div class="empty-state">لا توجد حسابات مسجلة.</div>';return}
 t.innerHTML=accounts.map(a=>{
  const self=a.id===sessionUser.id, owner=a.role==="owner";
  const roles=self?["owner"]:["student","teacher","admin"];
  const roleOptions=roles.map(r=>'<option value="'+r+'" '+(a.role===r?"selected":"")+'>'+r+'</option>').join("");
  return `<article class="owner-account" data-owner-account="${a.id}">
   <div class="owner-account-head"><div><b>${esc(a.display_name||"حساب")}</b><small>@${esc(a.username||"بدون اسم مستخدم")} · ${dateLabel(a.created_at)}</small><small class="account-id">${esc(a.id)}</small></div><span class="account-role">${owner?"OWNER":esc(a.role)}</span></div>
   <div class="owner-account-fields">
    <label>اسم المستخدم<input data-field="username" value="${esc(a.username||"")}" maxlength="24" pattern="[A-Za-z0-9_]{3,24}"></label>
    <label>الاسم الظاهر<input data-field="display_name" value="${esc(a.display_name||"")}" maxlength="60"></label>
    <label>الصلاحية<select data-field="role" ${self?"disabled":""}>${roleOptions}</select></label>
    <label>حالة الحساب<select data-field="approved" ${self?"disabled":""}><option value="true" ${a.is_approved?"selected":""}>مقبول</option><option value="false" ${!a.is_approved?"selected":""}>في انتظار الموافقة</option></select></label>
   </div>
   <div class="owner-account-actions"><button type="button" class="btn btn-outline btn-small" data-save-account>حفظ بيانات الحساب</button><label class="password-reset-field">كلمة مرور جديدة<input data-field="new_password" type="password" minlength="8" maxlength="72" autocomplete="new-password" placeholder="8 أحرف على الأقل"></label><button type="button" class="btn btn-primary btn-small" data-reset-password>تعيين كلمة المرور</button></div>
  </article>`;
 }).join("");
 $$("[data-save-account]").forEach(b=>b.addEventListener("click",async()=>{
  const row=b.closest("[data-owner-account]"),id=row.dataset.ownerAccount;
  const payload={action:"update_account",user_id:id,username:$('[data-field="username"]',row).value,display_name:$('[data-field="display_name"]',row).value,role:$('[data-field="role"]',row).value,is_approved:$('[data-field="approved"]',row).value==="true"};
  b.disabled=true;const {data,error}=await db.functions.invoke("owner-user-admin",{body:payload});b.disabled=false;
  if(error||data?.error){toast(data?.error||"تعذر حفظ الحساب.");return}
  toast("تم حفظ بيانات الحساب.");await loadAccounts();
 }));
 $$("[data-reset-password]").forEach(b=>b.addEventListener("click",async()=>{
  const row=b.closest("[data-owner-account]"),id=row.dataset.ownerAccount,input=$('[data-field="new_password"]',row),password=input.value;
  if(password.length<8||password.length>72){toast("كلمة المرور يجب أن تكون بين 8 و72 حرفًا.");input.focus();return}
  if(!window.confirm("سيتم استبدال كلمة مرور هذا الحساب فورًا. هل تريد المتابعة؟"))return;
  b.disabled=true;const {data,error}=await db.functions.invoke("owner-user-admin",{body:{action:"reset_password",user_id:id,password}});b.disabled=false;
  if(error||data?.error){toast(data?.error||"تعذر تغيير كلمة المرور.");return}
  input.value="";toast("تم تعيين كلمة المرور الجديدة.");
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
 let {data,error}=await db.rpc("submit_exam_attempt",{p_exam_id:activeExam.id,p_answers:answers});
  if(error&&String(error.message||"").includes("استكمال اسمك الثلاثي")){
   const entered=window.prompt("لإرسال التقرير الخاص بالمدرس، اكتب اسمك الثلاثي كاملًا:");
   if(entered){
    const saved=await db.rpc("set_my_full_name",{p_full_name:entered.trim()});
    if(!saved.error){profile.full_name=entered.trim();({data,error}=await db.rpc("submit_exam_attempt",{p_exam_id:activeExam.id,p_answers:answers}));}
    else error=saved.error;
   }
  }
  b.disabled=false;
 if(error){console.error(error);setStatus("#takeExamStatus",error.message?.includes("Retakes")?"هذه المحاولة غير متاحة لأن الامتحان يسمح بمحاولة واحدة فقط.":"تعذر تسليم الامتحان. حاول مرة أخرى.",true);return}
 const result=Array.isArray(data)?data[0]:data;
 const msg=result?.score==null?"تم تسليم الامتحان وحفظ المحاولة. النتيجة مخفية حسب إعداد المدرس.":"تم التصحيح بنجاح: "+result.score+" من "+result.max_score+".";
 setStatus("#takeExamStatus",msg);toast("تم حفظ إجابتك.");$("#examDialog").close();activeExam=null;activeQuestions=[];
 await Promise.all([loadAttempts(),loadStudentReports(),loadExams()]);if(sessionUser?.id==="5d0f01fe-d999-42e8-bb49-0b87a308e138")await loadTeacherReports();
}
async function submitAuth(event){
 event.preventDefault();const form=event.currentTarget,b=$(".auth-submit",form),v=new FormData(form);
 const username=String(v.get("username")||"").trim().toLowerCase(),password=String(v.get("password")||"");
 b.disabled=true;setStatus("#authStatus",authMode==="signup"?"جارٍ إنشاء الحساب...":"جارٍ تسجيل الدخول...");
 try{
  if(!/^[a-z0-9_]{3,24}$/.test(username))throw new Error("اسم المستخدم يجب أن يكون من 3 إلى 24 حرفًا إنجليزيًا أو رقمًا أو _.");
  if(authMode==="signup"){
   const name=String(v.get("displayName")||"").trim();if(name.split(/\\s+/).length<3)throw new Error("اكتب اسمك الثلاثي كاملًا لإنشاء الحساب.");
   if(["admin","administrator","owner","root","support"].includes(username))throw new Error("اسم المستخدم محجوز.");
   const internalEmail=username+"@accounts.sealx2.invalid";
   const {data,error}=await db.auth.signUp({email:internalEmail,password,options:{data:{display_name:name,full_name:name,username}}});
   if(error)throw error;
   if(!data.session)throw new Error("تعذر بدء الجلسة. تأكد من إيقاف تأكيد البريد الإلكتروني في إعدادات Supabase ثم أعد المحاولة.");
   const {error:sessionError}=await db.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
   if(sessionError)throw sessionError;
   $("#authDialog").close();await refreshSession();const nameSave=await db.rpc("set_my_full_name",{p_full_name:name});if(nameSave.error)console.error("Full name save:",nameSave.error);await loadProfile();updateAuthUI();toast("تم إنشاء الحساب. ينتظر الآن موافقة المدرس.");
  }else{
   const {data,error}=await db.functions.invoke("username-login",{body:{username,password}});
   if(error)throw new Error(data?.error||"اسم المستخدم أو كلمة المرور غير صحيحة.");
   if(!data?.access_token||!data?.refresh_token)throw new Error("تعذر إنشاء جلسة الدخول.");
   const {error:sessionError}=await db.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
   if(sessionError)throw sessionError;
   $("#authDialog").close();await refreshSession();if(profile?.is_approved===false)toast("حسابك في انتظار موافقة المدرس.");else toast("تم تسجيل الدخول.");
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
 $("#parseExamCodeBtn").addEventListener("click",importExamCode);$("#clearExamCodeBtn").addEventListener("click",()=>{$("#examSourceCode").value="";$("#importPreview").hidden=true;setStatus("#importStatus","");});
 $("#dangerUnlockBtn").addEventListener("click",()=>{if(!isOwner())return toast("هذه المنطقة لمالك المنصة فقط.");if(!dangerUnlocked){if(!window.confirm("تنبيه: أنت على وشك فتح منطقة الإدارة الحساسة. هل تريد المتابعة؟"))return;dangerUnlocked=true;$("#dangerContent").hidden=false;$("#dangerUnlockBtn").textContent="قفل أدوات الطوارئ";loadAccounts();}else{dangerUnlocked=false;$("#dangerContent").hidden=true;$("#dangerUnlockBtn").textContent="فتح أدوات الطوارئ";}});
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
