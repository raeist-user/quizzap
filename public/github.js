/* ══════════════════════════════════════
   RESOURCE BROWSER / GITHUB MANAGER
══════════════════════════════════════ */

// Upload panel state
let uploadTab='generate'; // 'generate' | 'manage'
let manageFolder=null;    // currently selected folder for editing
let editingContent='';    // textarea content while editing
let editingSha=null;      // SHA of existing file (for update)
let uploadMsg='';
let uploadSubjects=[];    // folders list for manage tab

function isValidToken() { 
  return MY_TOKEN && !MY_TOKEN.startsWith('%%') && MY_TOKEN.length > 0;
}
// GET requests must NOT include Content-Type — triggers CORS preflight that GitHub rejects
function ghReadHeaders(){
  const h={'Accept':'application/vnd.github+json'};
  if(isValidToken()) h['Authorization']='Bearer '+MY_TOKEN;
  return h;
}
// PUT/POST/DELETE can and should include Content-Type
function ghWriteHeaders(){
  const h={'Accept':'application/vnd.github+json','Content-Type':'application/json'};
  if(isValidToken()) h['Authorization']='Bearer '+MY_TOKEN;
  return h;
}
function ghHeaders(){ return ghReadHeaders(); } // legacy alias


async function browseRepo(){
  repoPath=GITHUB_REPO;
  const msg=document.getElementById('repo-msg');
  if(msg) msg.innerHTML='<div class="notice n-neutral mt2">Loading subjects…</div>';
  repoLoading=true; render();
  try{
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/resources?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`GitHub API ${res.status}: Check token and repo.`);
    const items=await res.json();
    const dirs=items.filter(i=>i.type==='dir');
    if(!dirs.length) throw new Error('No subject folders found inside "resources" folder.');
    // Keep existing file selections if subject already loaded
    subjects=dirs.map(d=>{
      const existing=subjects.find(s=>s.name===d.name);
      return existing||{name:d.name,path:d.path,files:[],filesLoaded:false};
    });
    repoLoading=false;
    if(msg) msg.innerHTML='';
    render();
  }catch(e){ repoLoading=false; if(msg) msg.innerHTML=`<div class="notice n-bad mt2">${esc(e.message)}</div>`; render(); }
}

// Load all .txt files inside a subject folder (called when subject is expanded)
async function loadSubjectFiles(subjName){
  const subj=subjects.find(s=>s.name===subjName);
  if(!subj||subj.filesLoaded) return;
  try{
    const encodedPath=subj.path.split('/').map(encodeURIComponent).join('/');
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${encodedPath}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const items=await res.json();
    subj.files=items
      .filter(i=>i.type==='file'&&i.name.endsWith('.txt')&&i.name!=='.gitkeep')
      .map(i=>({name:i.name,path:i.path,sha:i.sha,selected:false,count:0}));
    subj.filesLoaded=true;
    // If folder overlay is open for this subject, seed draft with newly loaded files
    if(folderOverlaySubject===subjName){
      subj.files.forEach(f=>{ if(!folderOverlayDraft[f.name]) folderOverlayDraft[f.name]={selected:f.selected,count:f.count||0}; });
      // Patch only the overlay body to avoid full-page re-render flicker
      const body=document.querySelector('.chapter-overlay-body');
      if(body){
        body.innerHTML=subj.files.length
          ?subj.files.map(f=>{
              const d=folderOverlayDraft[f.name]||{selected:false,count:0};
              return `<div class="chapter-row${d.selected?' sel':''}" data-ch-toggle="${esc(f.name)}">
                <div class="ch-check">${d.selected?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>':''}</div>
                <span class="ch-name">${esc(f.name.replace(/\.txt$/i,''))}</span>
                ${d.selected?`<input class="ch-count" type="number" min="0" max="999" value="${d.count||''}" placeholder="all" data-ch-cnt="${esc(f.name)}" title="0 or blank = all questions" onclick="event.stopPropagation()"/>`:'<span style="width:44px"></span>'}
              </div>`;
            }).join('')
          :'<p class="muted" style="padding:20px;text-align:center;font-size:.84rem">No .txt files in this folder.</p>';
        // Re-attach event listeners for the newly injected rows
        body.querySelectorAll('[data-ch-toggle]').forEach(el=>{
          el.addEventListener('click',e=>{
            if(e.target.tagName==='INPUT') return;
            const fn=el.dataset.chToggle;
            if(!folderOverlayDraft[fn]) folderOverlayDraft[fn]={selected:false,count:0};
            const nowSel=!folderOverlayDraft[fn].selected;
            folderOverlayDraft[fn].selected=nowSel;
            el.classList.toggle('sel',nowSel);
            const chk=el.querySelector('.ch-check');
            if(chk) chk.innerHTML=nowSel?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>':'';
            const existingInput=el.querySelector('.ch-count');
            const existingSpacer=el.querySelector('span[style*="width:44px"]');
            if(nowSel&&!existingInput){
              if(existingSpacer) existingSpacer.remove();
              const inp=document.createElement('input');
              inp.className='ch-count'; inp.type='number'; inp.min='0'; inp.max='999';
              inp.value=folderOverlayDraft[fn].count||''; inp.placeholder='all';
              inp.dataset.chCnt=fn; inp.title='0 or blank = all questions';
              inp.onclick=ev=>ev.stopPropagation();
              inp.addEventListener('change',()=>{ folderOverlayDraft[fn].count=Math.max(0,parseInt(inp.value)||0); });
              el.appendChild(inp);
            } else if(!nowSel&&existingInput){
              existingInput.remove();
              const sp=document.createElement('span'); sp.style.width='44px'; el.appendChild(sp);
            }
          });
        });
      }
    }
    render();
  }catch(e){ console.warn('Could not load files for',subjName,e.message); subj.filesLoaded=true; render(); }
}

async function loadUploadFolders(){
  try{
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/resources?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const items=await res.json();
    uploadSubjects=items.filter(i=>i.type==='dir').map(d=>({name:d.name,path:d.path}));
    render();
  }catch(e){ uploadSubjects=[]; render(); }
}

// Load all .txt files inside a folder for the manage tab
async function loadFolderFiles(folderName){
  try{
    const encoded=folderName.split('/').map(encodeURIComponent).join('/');
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encoded}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const items=await res.json();
    manageFolderFiles=items
      .filter(i=>i.type==='file'&&i.name.endsWith('.txt')&&i.name!=='.gitkeep')
      .map(i=>({name:i.name,path:i.path,sha:i.sha}));
    render();
  }catch(e){ manageFolderFiles=[]; render(); }
}

async function createFolder(){
  const inp=document.getElementById('new-folder-name');
  if(!inp) return;
  const name=inp.value.trim().replace(/[^a-zA-Z0-9_\- ]/g,'');
  if(!name){setUploadMsg('Folder name required','bad');return;}
  if(!isValidToken()){setUploadMsg('GitHub token not configured — add it to the source to enable uploads','bad');return;}
  setUploadMsg('Creating folder…','neutral');
  try{
    const path=`resources/${name}/.gitkeep`;
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,{
      method:'PUT',headers:ghWriteHeaders(),
      body:JSON.stringify({message:`Create ${name} folder`,content:btoa(''),branch:GITHUB_BRANCH})
    });
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    setUploadMsg(`Folder "${name}" created!`,'good');
    inp.value='';
    await loadUploadFolders();
  }catch(e){setUploadMsg(e.message,'bad');}
}

async function deleteFolder(folderName){
  if(!isValidToken()){setUploadMsg('GitHub token not configured — add it to the source to enable uploads','bad');return;}
  setUploadMsg('Deleting folder…','neutral');
  try{
    // List all files in the folder
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${folderName}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const items=await res.json();
    // Delete each file
    for(const item of items){
      const dr=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${item.path}`,{
        method:'DELETE',headers:ghWriteHeaders(),
        body:JSON.stringify({message:`Delete ${item.path}`,sha:item.sha,branch:GITHUB_BRANCH})
      });
      if(!dr.ok) throw new Error(`Failed to delete ${item.name}`);
    }
    manageFolder=null; manageEditMode=null; manageFile=null; manageFolderFiles=[]; manageNewFileName=''; editingContent=''; editingSha=null;
    setUploadMsg(`Folder "${folderName}" deleted.`,'good');
    await loadUploadFolders();
  }catch(e){setUploadMsg(e.message,'bad');}
}

async function deleteFile(folderName, fileName){
  if(!isValidToken()){setUploadMsg('GitHub token not configured','bad');return;}
  setUploadMsg(`Deleting ${fileName}…`,'neutral');
  try{
    const encodedFolder=encodeURIComponent(folderName);
    const encodedFile=encodeURIComponent(fileName);
    const apiUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encodedFolder}/${encodedFile}`;
    // Get SHA
    const chk=await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!chk.ok) throw new Error(`Could not find file: ${chk.status}`);
    const d=await chk.json();
    const res=await fetch(apiUrl,{
      method:'DELETE',headers:ghWriteHeaders(),
      body:JSON.stringify({message:`Delete resources/${folderName}/${fileName}`,sha:d.sha,branch:GITHUB_BRANCH})
    });
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    // If the deleted file was being edited, close the editor
    if(manageFile===fileName){ manageEditMode=null; manageFile=null; manageNewFileName=''; editingContent=''; editingSha=null; }
    setUploadMsg(`"${fileName}" deleted.`,'good');
    await loadFolderFiles(folderName);
  }catch(e){setUploadMsg(e.message,'bad');}
}

async function openFolderEdit(folderName, fileName){
  manageFolder=folderName; manageFile=fileName; editingContent=''; editingSha=null;
  setUploadMsg(`Loading ${esc(fileName)}…`,'neutral');
  render();
  try{
    const encodedFolder=encodeURIComponent(folderName);
    const encodedFile=encodeURIComponent(fileName);
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encodedFolder}/${encodedFile}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(res.status===404){ editingContent=''; editingSha=null; setUploadMsg(`${fileName} not found. Write content below to create it.`,'neutral'); render(); return; }
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data=await res.json();
    editingSha=data.sha;
    const bytes=Uint8Array.from(atob(data.content.replace(/\n/g,'')),c=>c.charCodeAt(0));
    editingContent=new TextDecoder('utf-8').decode(bytes);
    setUploadMsg('','');
    render();
    setTimeout(()=>{ const ta=document.getElementById('q-editor'); if(ta){ ta.value=editingContent; ta.focus(); } },50);
  }catch(e){setUploadMsg(e.message,'bad');}
}

async function saveEditorContent(){
  if(!manageFolder){setUploadMsg('No folder selected','bad');return;}
  // For new files, get filename from input
  let fileName=manageFile;
  if(manageEditMode==='new'){
    const inp=document.getElementById('new-file-name-editor');
    let n=inp?inp.value.trim():manageNewFileName;
    if(!n){setUploadMsg('Enter a file name','bad');return;}
    if(!n.endsWith('.txt')) n+='.txt';
    fileName=n;
  }
  if(!fileName){setUploadMsg('No file selected','bad');return;}
  if(!isValidToken()){setUploadMsg('GitHub token not configured — add it to the source to enable uploads','bad');return;}
  const ta=document.getElementById('q-editor');
  const content=ta?ta.value:'';
  if(!content.trim()){setUploadMsg('Content is empty','bad');return;}
  setUploadMsg('Saving…','neutral');
  try{
    const encodedFolder=encodeURIComponent(manageFolder);
    const encodedFile=encodeURIComponent(fileName);
    const apiPath=`resources/${manageFolder}/${fileName}`;
    const apiUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encodedFolder}/${encodedFile}`;
    // Always fetch latest SHA before saving to prevent 409 Conflict
    let sha=editingSha;
    if(!sha){
      const chk=await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
      if(chk.ok){ const d=await chk.json(); sha=d.sha; }
    }
    const body={message:`Update ${apiPath}`,content:btoa(unescape(encodeURIComponent(content))),branch:GITHUB_BRANCH};
    if(sha) body.sha=sha;
    const res=await fetch(apiUrl,{method:'PUT',headers:ghWriteHeaders(),body:JSON.stringify(body)});
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data=await res.json();
    editingSha=data.content?.sha||sha;
    manageFile=fileName;
    setUploadMsg('Saved successfully!','good');
    await loadFolderFiles(manageFolder);
  }catch(e){setUploadMsg(e.message,'bad');}
}

async function uploadQuestionsFile(){
  if(!manageFolder){setUploadMsg('Select a folder first','bad');return;}
  if(!isValidToken()){setUploadMsg('GitHub token not configured — add it to the source to enable uploads','bad');return;}
  const inp=document.getElementById('file-upload-inp');
  if(!inp||!inp.files.length){setUploadMsg('Choose a .txt file first','bad');return;}
  const file=inp.files[0];
  if(!file.name.endsWith('.txt')){setUploadMsg('Only .txt files allowed','bad');return;}
  const targetFile=file.name; // use the actual uploaded filename
  setUploadMsg('Reading file…','neutral');
  const reader=new FileReader();
  reader.onload=async(ev)=>{
    const content=ev.target.result;
    try{
      setUploadMsg('Uploading…','neutral');
      const encodedFolder=encodeURIComponent(manageFolder);
      const encodedFile=encodeURIComponent(targetFile);
      const apiUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encodedFolder}/${encodedFile}`;
      // Fetch existing SHA to avoid 409 if file exists
      let sha=null;
      const chk=await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
      if(chk.ok){ const d=await chk.json(); sha=d.sha; }
      const body={message:`Upload resources/${manageFolder}/${targetFile}`,content:btoa(unescape(encodeURIComponent(content))),branch:GITHUB_BRANCH};
      if(sha) body.sha=sha;
      const res=await fetch(apiUrl,{method:'PUT',headers:ghWriteHeaders(),body:JSON.stringify(body)});
      if(!res.ok) throw new Error(`GitHub API ${res.status}`);
      setUploadMsg(`Uploaded as ${targetFile}!`,'good');
      await loadFolderFiles(manageFolder);
    }catch(err){setUploadMsg(err.message,'bad');}
  };
  reader.readAsText(file);
}

function setUploadMsg(msg,type){
  uploadMsg=msg?`<div class="notice n-${type} mt2">${esc(msg)}</div>`:'';
  const el=document.getElementById('upload-msg');
  if(el) el.innerHTML=uploadMsg;
}

async function generateQuiz(){
  const msg=document.getElementById('gen-msg'); if(!msg)return;
  const selections=[];
  subjects.forEach(s=>{
    s.files.filter(f=>f.selected).forEach(f=>selections.push({file:f,subjName:s.name}));
  });
  if(!selections.length){msg.innerHTML='<div class="notice n-bad mt2">Select at least one chapter file above.</div>';return;}
  // Denominator is now based on questions actually pushed, not questions loaded
  msg.innerHTML='<div class="notice n-neutral mt2">Fetching questions…</div>';
  let all=[];
  try{
    for(const {file,subjName} of selections){
      // Use GitHub contents API (not raw.githubusercontent.com) — avoids CORS preflight rejection
      const encodedPath=file.path.split('/').map(encodeURIComponent).join('/');
      const apiUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/${encodedPath}?ref=${GITHUB_BRANCH}`;
      const res=await fetch(apiUrl,{headers:ghHeaders()});
      if(!res.ok) throw new Error(`Could not fetch ${file.name} (HTTP ${res.status})`);
      const data=await res.json();
      // Decode base64 content (handles UTF-8 / Hindi / Urdu etc.)
      const bytes=Uint8Array.from(atob(data.content.replace(/\n/g,'')),c=>c.charCodeAt(0));
      const text=new TextDecoder('utf-8').decode(bytes);
      const parsed=parseQuestions(text);
      if(!parsed.length) throw new Error(`No valid questions found in ${file.name}`);
      const take=(file.count>0)?Math.min(file.count,parsed.length):parsed.length;
      const ordered=hostRandomize?[...parsed].sort(()=>Math.random()-.5):parsed;
      const picked=ordered.slice(0,take);
      picked.forEach(q=>{ q.subject=subjName; q.chapter=file.name.replace(/\.txt$/i,''); });
      all=[...all,...picked];
    }
    questions=all; selIdx=0; answerKey=all[0]?.correct??-1;
    msg.innerHTML=''; render();
  }catch(e){ msg.innerHTML=`<div class="notice n-bad mt2">${esc(e.message)}</div>`; }
}

/* ══════════════════════════════════════
   GITHUB QUESTION UPDATER
   Reads the source .txt file, finds the question, moves the @ marker
   to the newly selected correct option, and writes back to GitHub.
══════════════════════════════════════ */
async function updateReportedQuestionInGitHub(q, newText, newOptions, newCorrect){
  if(!q||!q.subject||!q.chapter) return {ok:false,error:'No subject/chapter info on question'};
  if(!isValidToken())             return {ok:false,error:'No GitHub token configured'};
  const fileName=q.chapter+'.txt';
  const encS=q.subject.split('/').map(encodeURIComponent).join('/');
  const encF=encodeURIComponent(fileName);
  const apiUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encS}/${encF}?ref=${GITHUB_BRANCH}`;
  try{
    const res=await fetch(apiUrl,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`Cannot read file (HTTP ${res.status})`);
    const data=await res.json();
    const bytes=Uint8Array.from(atob(data.content.replace(/\n/g,'')),c=>c.charCodeAt(0));
    const fileText=new TextDecoder('utf-8').decode(bytes);
    const lines=fileText.split('\n');
    // Find question line — strip leading "1. " numbering before comparing
    const origText=q.text.trim();
    let qi=-1;
    for(let i=0;i<lines.length;i++){
      const stripped=lines[i].trim().replace(/^\d+[.)]\s*/,'');
      if(stripped===origText&&i+1<lines.length&&/\(A\)/i.test(lines[i+1])){ qi=i; break; }
    }
    if(qi<0) return {ok:false,error:'Question not found in file — edit manually'};
    // Preserve existing number prefix  e.g. "12. "
    const pfx=(lines[qi].match(/^(\d+[.)]\s*)/))||[''];
    lines[qi]=pfx[0]+newText.trim();
    // Rebuild option line with @ on correct answer
    lines[qi+1]=newOptions.map((o,i)=>`(${['A','B','C','D'][i]}) ${o.replace(/@/g,'').trim()}${i===newCorrect?' @':''}`).join(', ');
    const newContent=lines.join('\n');
    const writeUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encS}/${encF}`;
    const wr=await fetch(writeUrl,{method:'PUT',headers:ghWriteHeaders(),body:JSON.stringify({
      message:`Fix answer: ${newText.trim().slice(0,55)}`,
      content:btoa(unescape(encodeURIComponent(newContent))),
      sha:data.sha, branch:GITHUB_BRANCH
    })});
    if(!wr.ok) throw new Error(`Write failed (HTTP ${wr.status})`);
    return {ok:true};
  }catch(e){ return {ok:false,error:e.message}; }
}
