console.log("ver5.4")

// --- Clean URL if redirected from Supabase OAuth ---

const supabaseUrl = 'https://kcijljeifwpemznezyam.supabase.co';   // 👈 Your URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjaWpsamVpZndwZW16bmV6eWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MDAxOTcsImV4cCI6MjA2MTI3NjE5N30.11fHMwRwZPtmQHVErEoJyROgim3eNy3XNL5DxPJd574'; // 👈 Your anon key
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let projects = [];
let selectedProject = null;

// --- Handle OAuth Redirect ---
async function handleRedirect() {
  if (window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
      console.log('Session set manually.');
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  checkSession();
}

async function checkSession() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    console.log('No session, staying on login page');
    return;
  }
  console.log('Session found, starting app...');
  currentUser = data.user;
  startApp();
}

function startApp() {
  document.getElementById('authPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'grid';
  loadProjects();
}

// --- Authentication ---
document.getElementById('googleLoginButton').addEventListener('click', loginWithGoogle);

async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://clanbulance.github.io/todo' }
  });

  if (error) console.error('Google Login Error:', error.message);
}

async function logoutUser() {
  await supabase.auth.signOut();
  window.location.reload();
}

// --- Projects Management ---
async function loadProjects() {
  const { data, error } = await supabase.from('projects').select('*').eq('user_id', currentUser.id);
  if (error) {
    console.error('Error loading projects:', error.message);
    return;
  }
  projects = data || [];
  renderProjects();
}

async function renderProjects() {
  const left = document.querySelector('.sidebar');
  left.innerHTML = '';

  const profilePic = document.createElement('img');
  profilePic.src = currentUser.user_metadata?.avatar_url || 'https://via.placeholder.com/100';
  left.appendChild(profilePic);

  const username = document.createElement('div');
  username.className = 'username';
  username.textContent = currentUser.user_metadata?.full_name || currentUser.email;
  left.appendChild(username);

  const addProjectBtn = document.createElement('button');
  addProjectBtn.className = 'add-project-btn';
  addProjectBtn.textContent = '+ Add Project';
  addProjectBtn.addEventListener('click', openProjectPopup);
  left.appendChild(addProjectBtn);

  const { data: openTasksData } = await supabase.from('tasks').select('id, project_id').eq('is_finished', false);
  const openTasksCount = {};
  (openTasksData || []).forEach(task => {
    openTasksCount[task.project_id] = (openTasksCount[task.project_id] || 0) + 1;
  });

  for (const project of projects) {
    const div = document.createElement('div');
    div.className = 'project';
    if (selectedProject && selectedProject.id === project.id) div.classList.add('active');

    const openCount = openTasksCount[project.id] || 0;
    div.innerHTML = `
      ${project.name}
      <span class="task-count">${openCount}</span>
      <br>
      <button class="small-btn edit-project">✏️</button>
      <button class="small-btn delete-project" style="background-color:#ef4444;">🗑️</button>
    `;

    div.querySelector('.edit-project').addEventListener('click', (e) => {
      e.stopPropagation();
      editProject(project.id, project.name);
    });

    div.querySelector('.delete-project').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteProject(project.id);
    });

    div.addEventListener('click', () => {
      selectedProject = project;
      loadTasksForProject(project.id);
    });

    left.appendChild(div);
  }

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'add-project-btn';
  logoutBtn.style.backgroundColor = '#ef4444';
  logoutBtn.style.marginTop = '20px';
  logoutBtn.textContent = 'Logout';
  logoutBtn.addEventListener('click', logoutUser);
  left.appendChild(logoutBtn);
}

function openProjectPopup() {
  openInputModal('New Project', 'Enter Project Name...', (name) => {
    createProject(name);
  });
}

async function createProject(name) {
  await supabase.from('projects').insert([{ name, user_id: currentUser.id }]);
  loadProjects();
}

async function editProject(id, oldName) {
  const newName = prompt('Edit Project Name:', oldName);
  if (newName) {
    await supabase.from('projects').update({ name: newName }).eq('id', id);
    loadProjects();
  }
}

async function deleteProject(id) {
  if (confirm('Delete project and all its tasks?')) {
    await supabase.from('tasks').delete().eq('project_id', id);
    await supabase.from('projects').delete().eq('id', id);
    loadProjects();
  }
}

// --- Tasks Management ---
async function loadTasksForProject(projectId) {
  const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId);
  if (error) {
    console.error('Error loading tasks:', error.message);
    return;
  }
  renderTasks(data || []);
}

function renderTasks(tasks) {
  const right = document.querySelector('.main');
  right.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = selectedProject.name;
  right.appendChild(title);

  const addTaskBtn = document.createElement('button');
  addTaskBtn.className = 'primary-btn';
  addTaskBtn.textContent = '+ Add Task';
  addTaskBtn.style.marginLeft = '20px';
  addTaskBtn.addEventListener('click', openTaskPopup);
  right.appendChild(addTaskBtn);

  const openTasks = tasks.filter(task => !task.is_finished);
  const finishedTasks = tasks.filter(task => task.is_finished);

  renderTaskList('Open Tasks', openTasks, false, right);
  if (finishedTasks.length > 0) renderTaskList('Finished Tasks', finishedTasks, true, right);
}

function renderTaskList(titleText, tasks, finished, container) {
  const title = document.createElement('h3');
  title.textContent = titleText;
  title.style.marginTop = '30px';
  container.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'tasks-grid';
  container.appendChild(grid);

  tasks.forEach(task => {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task';
    taskDiv.innerHTML = `
      <strong>${task.task_name}</strong><br>
      Due: ${task.due_date}<br>
      Status: ${finished ? '✅ Finished' : '❌ Not Finished'}
      ${!finished ? `
        <br>
        <button class="small-btn finish-task">Finish</button>
        <button class="small-btn edit-task">Edit</button>
      ` : ''}
    `;

    if (!finished) {
      taskDiv.querySelector('.finish-task').addEventListener('click', (e) => {
        e.stopPropagation();
        finishTask(task.id);
      });
      taskDiv.querySelector('.edit-task').addEventListener('click', (e) => {
        e.stopPropagation();
        editTask(task.id, task.task_name, task.due_date);
      });
    }

    grid.appendChild(taskDiv);
  });
}

function openTaskPopup() {
  openTaskModal((name, dueDate) => {
    createTask(name, dueDate);
  });
}

// --- Modals ---
function openInputModal(title, placeholder, onSubmit) { /*...*/ }
function openTaskModal(onSubmit) { /*...*/ }
function openEditTaskModal(oldName, oldDueDate, onSubmit) { /*...*/ }

// --- Tasks API ---
async function createTask(name, dueDate) { /*...*/ }
async function finishTask(id) { /*...*/ }
async function editTask(id, oldName, oldDueDate) { /*...*/ }

// --- Sparkles ---
window.startSparkles = function() { /* sparkle code */ }

// --- Start App ---
handleRedirect();
startSparkles();