// Initialize Supabase connection

const supabaseUrl = 'https://kcijljeifwpemznezyam.supabase.co';   // 👈 Your URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjaWpsamVpZndwZW16bmV6eWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MDAxOTcsImV4cCI6MjA2MTI3NjE5N30.11fHMwRwZPtmQHVErEoJyROgim3eNy3XNL5DxPJd574'; // 👈 Your anon key
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
let currentUser = null;
let projects = [];
let selectedProject = null;

// ===================
// 2. Check Session on Page Load
// ===================

async function checkSession() {
  const { data, error } = await supabase.auth.getSession();

  if (data.session) {
    console.log('SESSION FOUND:', data.session); // ✅ debug line

    currentUser = data.session.user;  // 👈 safe way
    console.log('CURRENT USER:', currentUser); // ✅ debug line

    document.getElementById('authPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'grid';
    loadProjects();
  } else {
    console.log('No active session');
  }
}

checkSession();

// ===================
// 3. Popup Helpers
// ===================

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
  overlay.style.backdropFilter = 'blur(5px)';
  overlay.style.zIndex = '1000';
  overlay.addEventListener('click', closePopup);
  document.body.appendChild(overlay);
}

function openPopup(content) {
  createOverlay();
  const popup = document.createElement('div');
  popup.id = 'popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.zIndex = '1001';
  popup.innerHTML = content;
  document.body.appendChild(popup);
}

function closePopup() {
  const popup = document.getElementById('popup');
  const overlay = document.getElementById('overlay');
  if (popup) popup.remove();
  if (overlay) overlay.remove();
}

function showMessage(messageText) {
  openPopup(`
    <h2>${messageText}</h2>
    <br>
    <button id="popupOk">OK</button>
  `);

  document.getElementById('popupOk').addEventListener('click', closePopup);
}

// ===================
// 4. Login and Register
// ===================

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('googleLoginButton').addEventListener('click', loginWithGoogle);

async function handleLogin() {
  const username = document.getElementById('popupUsername').value.trim().toLowerCase();
  const password = document.getElementById('popupPassword').value;

  if (!username || !password) return showMessage('Please fill all fields!');
  const hashed = await hashPassword(password);

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !data) return showMessage('User not found!');
  if (data.password_hash !== hashed) return showMessage('Incorrect password!');

  currentUser = data;
  closePopup();
  document.getElementById('authPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'grid';
  loadProjects();
}

async function handleRegister() {
  const username = document.getElementById('popupUsername').value.trim().toLowerCase();
  const password = document.getElementById('popupPassword').value;

  if (!username || !password) return showMessage('Please fill all fields!');
  const hashed = await hashPassword(password);

  const { error } = await supabase
    .from('users')
    .insert([{ username, password_hash: hashed }]);

  if (error) return showMessage('Registration failed!');
  closePopup();
  showMessage('Registered successfully! Please login.');
}

async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google'
  });
  if (error) showMessage('Error logging in with Google.');
}

// ===================
// 5. Project Management
// ===================

async function loadProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', currentUser.id);

  if (error) {
    console.error(error);
    return;
  }

  projects = data || [];
  renderProjects();
}

function renderProjects() {
  if (!currentUser) {
    console.error('Current user not found');
    return;
  }

  const left = document.querySelector('.left');
  left.innerHTML = '';

  // Profile Picture
  const user = currentUser;
  const profilePic = document.createElement('img');
  profilePic.id = 'profilePicture';
  profilePic.style.width = '80px';
  profilePic.style.height = '80px';
  profilePic.style.borderRadius = '50%';
  profilePic.style.objectFit = 'cover';
  profilePic.style.marginBottom = '20px';
  profilePic.style.border = '2px solid #00a8ff';
  profilePic.style.cursor = 'pointer';

  if (user && user.user_metadata && user.user_metadata.avatar_url) {
    profilePic.src = user.user_metadata.avatar_url;
  } else {
    profilePic.src = 'https://via.placeholder.com/80?text=User';
  }
  left.appendChild(profilePic);

  // Logout Button
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logoutButton';
  logoutBtn.textContent = 'Logout';
  logoutBtn.className = 'logout-btn';
  logoutBtn.addEventListener('click', logoutUser);
  left.appendChild(logoutBtn);

  // Add Project Button
  const addProjectBtn = document.createElement('div');
  addProjectBtn.id = 'AddButton';
  addProjectBtn.textContent = '+';
  addProjectBtn.addEventListener('click', openProjectPopup);
  left.appendChild(addProjectBtn);

  // List Projects
  projects.forEach(project => {
    const div = document.createElement('div');
    div.className = 'project';
    div.innerHTML = `
      <div class="projectName">${project.name}</div>
      <button class="deleteProjectBtn">❌</button>
    `;

    div.addEventListener('click', () => {
      selectedProject = project;
      loadTasksForProject(project.id);
    });

    div.querySelector('.deleteProjectBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteProject(project.id);
    });

    left.appendChild(div);
  });
}

async function deleteProject(id) {
  if (!confirm('Delete this project and all tasks?')) return;
  await supabase.from('tasks').delete().eq('project_id', id);
  await supabase.from('projects').delete().eq('id', id);
  loadProjects();
}

function openProjectPopup() {
  openPopup(`
    <h2>Add Project</h2>
    <input type="text" id="popupProjectName" class="popupInput" placeholder="Project name">
    <br>
    <button id="popupCreateProject">Create</button>
    <button id="popupCancel">Cancel</button>
  `);

  document.getElementById('popupCreateProject').addEventListener('click', async () => {
    const name = document.getElementById('popupProjectName').value.trim();
    if (!name) return showMessage('Project name required!');
    await supabase.from('projects').insert([{ name: name,user_id: currentUser.id }]);
    closePopup();
    loadProjects();
  });

  document.getElementById('popupCancel').addEventListener('click', closePopup);
}

// ===================
// 6. Task Management
// ===================

async function loadTasksForProject(projectId) {
  const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId);
  if (error) console.error(error);
  renderTasks(data || []);
}

function renderTasks(tasks) {
  const right = document.querySelector('.right');
  right.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = selectedProject.name;
  right.appendChild(title);

  const btn = document.createElement('button');
  btn.textContent = '+ Add Task';
  btn.addEventListener('click', openTaskPopup);
  right.appendChild(btn);

  const taskList = document.createElement('div');
  taskList.id = 'taskList';
  right.appendChild(taskList);

  tasks.forEach(task => {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task';
    taskDiv.innerHTML = `
      <strong>${task.task_name}</strong><br>Due: ${task.due_date}<br>Status: ${task.is_finished ? '✅' : '❌'}
      ${task.is_finished ? '' : `<br><button onclick="finishTask('${task.id}')">Mark as Finished</button>`}
    `;
    taskList.appendChild(taskDiv);
  });
}

window.finishTask = async function(taskId) {
  const { error } = await supabase.from('tasks').update({ is_finished: true }).eq('id', taskId);
  if (error) return console.error(error);
  loadTasksForProject(selectedProject.id);
};

function openTaskPopup() {
  openPopup(`
    <h2>Add Task</h2>
    <input type="text" id="taskNameInput" class="popupInput" placeholder="Task name">
    <input type="date" id="taskDueDateInput" class="popupInput">
    <br>
    <button id="saveTaskButton">Save</button>
    <button id="popupCancel">Cancel</button>
  `);

  document.getElementById('saveTaskButton').addEventListener('click', async () => {
    const name = document.getElementById('taskNameInput').value.trim();
    const dueDate = document.getElementById('taskDueDateInput').value;
    if (!name || !dueDate) return showMessage('Fill in all fields!');
    await supabase.from('tasks').insert([{ task_name: name, due_date: dueDate, is_finished: false, project_id: selectedProject.id }]);
    closePopup();
    loadTasksForProject(selectedProject.id);
  });

  document.getElementById('popupCancel').addEventListener('click', closePopup);
}

// ===================
// 7. Logout
// ===================

function logoutUser() {
  currentUser = null;
  projects = [];
  selectedProject = null;
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('authPage').style.display = 'flex';
}