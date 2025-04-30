
console.log("ver6.9")

const supabaseUrl = 'https://kcijljeifwpemznezyam.supabase.co';  // replace with your actual URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjaWpsamVpZndwZW16bmV6eWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MDAxOTcsImV4cCI6MjA2MTI3NjE5N30.11fHMwRwZPtmQHVErEoJyROgim3eNy3XNL5DxPJd574y';                 // replace with your actual anon public API key
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
window.supabaseClient = supabase;

let currentUser = null;
let projects = [];
let selectedProject = null;

async function handleRedirect() {
  if (window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  checkSession();
}

async function checkSession() {
  const { data, error } = await supabase.auth.getUser();
  console.log("Session check result:", data, error);
  if (error || !data.user) {
    console.log('No session, staying on login page');
    return;
  }
  currentUser = data.user;
  console.log("Logged in user:", currentUser);
  startApp();
}

async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (error) console.error('Login error:', error.message);
}

async function logoutUser() {
  await supabase.auth.signOut();
  window.location.reload();
}

function startApp() {
  document.getElementById('authPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'grid';
  loadProjects();
}

async function loadProjects() {
  const { data, error } = await supabase.from('projects').select('*').eq('user_id', currentUser.id);
  if (error) return console.error('Load Projects Error:', error.message);
  projects = data || [];
  renderProjects();
}

function renderProjects() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.innerHTML = '';

  const profilePic = document.createElement('img');
  profilePic.src = currentUser.user_metadata?.avatar_url || 'https://via.placeholder.com/100';
  sidebar.appendChild(profilePic);

  const username = document.createElement('div');
  username.className = 'username';
  username.textContent = currentUser.user_metadata?.full_name || currentUser.email;
  sidebar.appendChild(username);

  const addProjectBtn = document.createElement('button');
  addProjectBtn.className = 'add-project-btn';
  addProjectBtn.textContent = '+ Add Project';
  addProjectBtn.addEventListener('click', openProjectPopup);
  sidebar.appendChild(addProjectBtn);

  projects.forEach(project => {
    const div = document.createElement('div');
    div.className = 'project';
    if (selectedProject && selectedProject.id === project.id) div.classList.add('active');
    div.textContent = project.name;
    div.addEventListener('click', () => {
      selectedProject = project;
      loadTasks();
    });
    sidebar.appendChild(div);
  });

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'add-project-btn';
  logoutBtn.style.backgroundColor = '#ef4444';
  logoutBtn.textContent = 'Logout';
  logoutBtn.addEventListener('click', logoutUser);
  sidebar.appendChild(logoutBtn);
}

async function loadTasks() {
  const { data, error } = await supabase.from('tasks').select('*').eq('project_id', selectedProject.id);
  if (error) return console.error('Load Tasks Error:', error.message);
  renderTasks(data);
}

function renderTasks(tasks) {
  const main = document.querySelector('.main');
  main.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = selectedProject.name;
  main.appendChild(title);

  const addTaskBtn = document.createElement('button');
  addTaskBtn.className = 'primary-btn';
  addTaskBtn.textContent = '+ Add Task';
  addTaskBtn.addEventListener('click', openTaskPopup);
  main.appendChild(addTaskBtn);

  tasks.forEach(task => {
    const div = document.createElement('div');
    div.className = 'task';
    div.innerHTML = `
      <strong>${task.task_name}</strong><br>
      Due: ${task.due_date}<br>
      Status: ${task.is_finished ? '✅' : '❌'}<br>
    `;
    main.appendChild(div);
  });
}

function openInputModal(title, onSubmit) {
  const modal = document.createElement('div');
  modal.className = 'custom-modal';
  modal.innerHTML = `
    <div class="custom-modal-content">
      <h2>${title}</h2>
      <input type="text" placeholder="Type here..." autofocus />
      <div class="modal-buttons">
        <button class="save-btn">Save</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.save-btn').addEventListener('click', () => {
    const input = modal.querySelector('input').value.trim();
    if (input) {
      onSubmit(input);
      document.body.removeChild(modal);
    }
  });
  modal.querySelector('.cancel-btn').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
}

function openProjectPopup() {
  openInputModal('New Project', async (projectName) => {
    const { error } = await supabase.from('projects').insert([{ name: projectName, user_id: currentUser.id }]);
    if (error) return alert('Error creating project');
    loadProjects();
  });
}

function openTaskPopup() {
  openInputModal('New Task', async (taskName) => {
    const dueDate = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('tasks').insert([{ task_name: taskName, due_date: dueDate, project_id: selectedProject.id, is_finished: false }]);
    if (error) return alert('Error creating task');
    loadTasks();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('googleLoginButton').addEventListener('click', loginWithGoogle);
  handleRedirect();
});
