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
 let attempts=[];if(sessionUser){const a=await db.rpc("get_my_exam_ids");attempts=(a.data||[]).map(x=>({exam_id:x.exam_id}))}
 const done=new Set(attempts.map(a=>a.exam_id));
 target.innerHTML=data.map(e=>{const blocked=!e.allow_retake&&done.has(e.id);return '<article class="content-card"><span class="card-icon">✎</span><h3>'+esc(e.title)+'</h3><p>'+esc(e.description||"اختبار علوم متكامل")+'</p><div class="student-exam-meta"><span class="exam-pill">'+esc(e.subjects?.name||"العلوم المتكاملة")+'</span><span>'+e.duration_minutes+' دقيقة</span><span>'+e.pass_percent+'% للنجاح</span></div><div class="card-foot"><span>'+(blocked?"تمت المحاولة":"اختيار من متعدد")+'</span><button '+(blocked?'disabled':'')+' data-start-exam="'+e.id+'">'+(blocked?"غير متاح":"ابدأ الامتحان ↗")+'</button></div></article>'}).join("");
 $$("[data-start-exam]").forEach(b=>b.addEventListener("click",()=>startExam(b.dataset.startExam)));
}
async function loadResources(){const t=$("#resourceGrid"),{data,error}=await db.from("resources").select("*").eq("published",true).order("created_at",{ascending:false});if(error){t.innerHTML='<div class="loading-card">تعذر تحميل المصادر.</div>';return}if(!data.length){t.innerHTML='<div class="loading-card">سيتم إضافة المصادر التعليمية هنا.</div>';return}t.innerHTML=data.map(r=>'<article class="content-card"><span class="card-icon">▤</span><h3>'+esc(r.title)+'</h3><p>'+esc(r.description)+'</p><div class="card-foot"><span>مصدر تعليمي</span><a href="'+esc(r.resource_url)+'" target="_blank" rel="noopener noreferrer">فتح المصدر ↗</a></div></article>').join("")}
async function loadAnnouncements(){const t=$("#announcementList"),{data,error}=await db.from("announcements").select("*").eq("published",true).order("pinned",{ascending:false}).order("created_at",{ascending:false});if(error){t.innerHTML='<div class="loading-card">تعذر تحميل الإعلانات.</div>';return}if(!data.length){t.innerHTML='<div class="loading-card">لا توجد إعلانات حالياً.</div>';return}t.innerHTML=data.map(a=>'<article class="announcement-item"><small>'+(a.pinned?"✦ إعلان مهم · ":"")+dateLabel(a.created_at)+'</small><h3>'+esc(a.title)+'</h3><p>'+esc(a.body)+'</p></article>').join("")}
async function loadAttempts(){const {data,error}=await db.rpc("get_my_attempts");const t=$("#attemptList");if(error){t.textContent="تعذر تحميل النتائج.";return}t.innerHTML=data.length?data.map(a=>'<div class="attempt-item"><span>'+esc(a.exam_title||"امتحان")+'<br><small>'+dateLabel(a.submitted_at)+'</small></span><b>'+(a.score===null?"تم التسليم":a.score+" / "+a.max_score)+'</b></div>').join(""):'<div class="loading-card">ستظهر نتائجك هنا بعد حل أول امتحان.</div>'}
