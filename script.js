console.log("ver6.6")

// --- Clean URL if redirected from Supabase OAuth ---

const supabaseUrl = 'https://kcijljeifwpemznezyam.supabase.co';   // 👈 Your URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjaWpsamVpZndwZW16bmV6eWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MDAxOTcsImV4cCI6MjA2MTI3NjE5N30.11fHMwRwZPtmQHVErEoJyROgim3eNy3XNL5DxPJd574'; // 👈 Your anon key
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let projects = [];
let selectedProject = null;

// AUTH
async function handleRedirect() {
  if (window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      console.log('Access token received');
      await supabase.auth.setSession({ access_token, refresh_token });
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

async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://clanbulance.github.io/todo' }
  });
  if (error) {
    console.error('Login error:', error.message);
  }
}

async function logoutUser() {
  await supabase.auth.signOut();
  window.location.reload();
}

document.getElementById('googleLoginButton').addEventListener('click', loginWithGoogle);

function startApp() {
  document.getElementById('authPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'grid';
  loadProjects();
}

// PROJECTS
async function createProject(name) {
  const { error } = await supabase.from('projects').insert([{ name, user_id: currentUser.id }]);
  if (error) {
    console.error('Create Project Error:', error.message);
    alert('Failed to create project!');
  } else {
    loadProjects();
  }
}

async function editProject(id, oldName) {
  openInputModal('Edit Project', oldName, async (newName) => {
    const { error } = await supabase.from('projects').update({ name: newName }).eq('id', id);
    if (error) {
      console.error('Edit Project Error:', error.message);
      alert('Failed to edit project!');
    } else {
      loadProjects();
    }
  });
}

async function deleteProject(id) {
  if (confirm('Delete this project and all its tasks?')) {
    await supabase.from('tasks').delete().eq('project_id', id);
    await supabase.from('projects').delete().eq('id', id);
    loadProjects();
  }
}

// TASKS
async function createTask(name, dueDate) {
  await supabase.from('tasks').insert([{ task_name: name, due_date: dueDate, is_finished: false, project_id: selectedProject.id }]);
  loadTasksForProject(selectedProject.id);
}

async function finishTask(id) {
  await supabase.from('tasks').update({ is_finished: true }).eq('id', id);
  loadTasksForProject(selectedProject.id);
}

async function editTask(id, oldName, oldDueDate) {
  openTaskModal(oldName, oldDueDate, async (newName, newDueDate) => {
    await supabase.from('tasks').update({ task_name: newName, due_date: newDueDate }).eq('id', id);
    loadTasksForProject(selectedProject.id);
  });
}

// RENDER
async function loadProjects() {
  const { data, error } = await supabase.from('projects').select('*').eq('user_id', currentUser.id);
  if (error) {
    console.error('Load Projects Error:', error.message);
    return;
  }
  projects = data || [];
  renderProjects();
}

async function renderProjects() {
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

  const { data: openTasksData } = await supabase.from('tasks').select('id, project_id').eq('is_finished', false);
  const openTasksCount = {};
  (openTasksData || []).forEach(task => {
    openTasksCount[task.project_id] = (openTasksCount[task.project_id] || 0) + 1;
  });

  projects.forEach(project => {
    const div = document.createElement('div');
    div.className = 'project';
    if (selectedProject && selectedProject.id === project.id) div.classList.add('active');
    div.innerHTML = `
      ${project.name}
      <span class="task-count">${openTasksCount[project.id] || 0}</span>
      <div class="small-btns">
        <button class="edit-btn">✏️</button>
        <button class="delete-btn">🗑️</button>
      </div>
    `;
    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-btn')) {
        e.stopPropagation();
        editProject(project.id, project.name);
      } else if (e.target.classList.contains('delete-btn')) {
        e.stopPropagation();
        deleteProject(project.id);
      } else {
        selectedProject = project;
        loadTasksForProject(project.id);
      }
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

async function loadTasksForProject(projectId) {
  const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId);
  if (error) {
    console.error('Load Tasks Error:', error.message);
    return;
  }
  renderTasks(data || []);
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

  const openTasks = tasks.filter(t => !t.is_finished);
  const finishedTasks = tasks.filter(t => t.is_finished);

  const openTitle = document.createElement('h3');
  openTitle.textContent = 'Open Tasks';
  main.appendChild(openTitle);

  const openGrid = document.createElement('div');
  openGrid.className = 'tasks-grid';
  main.appendChild(openGrid);

  openTasks.forEach(task => {
    const div = document.createElement('div');
    div.className = 'task';
    div.innerHTML = `
      <strong>${task.task_name}</strong><br>
      Due: ${task.due_date}<br>
      Status: ❌<br>
      <button class="finish-btn">Finish</button>
      <button class="edit-btn">Edit</button>
    `;
    div.querySelector('.finish-btn').addEventListener('click', () => finishTask(task.id));
    div.querySelector('.edit-btn').addEventListener('click', () => editTask(task.id, task.task_name, task.due_date));
    openGrid.appendChild(div);
  });

  if (finishedTasks.length > 0) {
    const finishedTitle = document.createElement('h3');
    finishedTitle.textContent = 'Finished Tasks';
    main.appendChild(finishedTitle);

    const finishedGrid = document.createElement('div');
    finishedGrid.className = 'tasks-grid';
    main.appendChild(finishedGrid);

    finishedTasks.forEach(task => {
      const div = document.createElement('div');
      div.className = 'task';
      div.innerHTML = `
        <strong>${task.task_name}</strong><br>
        Due: ${task.due_date}<br>
        Status: ✅
      `;
      finishedGrid.appendChild(div);
    });
  }
}

// MODALS (Fixed)
function openInputModal(title, defaultValue, onSubmit) {
  const modal = document.createElement('div');
  modal.className = 'custom-modal';
  modal.innerHTML = `
    <div class="custom-modal-content">
      <h2>${title}</h2>
     <input type="text" name="projectName" placeholder="Type here..." value="${defaultValue || ''}" autofocus />
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

function openTaskModal(oldName, oldDueDate, onSubmit) {
  const modal = document.createElement('div');
  modal.className = 'custom-modal';
  modal.innerHTML = `
    <div class="custom-modal-content">
      <h2>Edit Task</h2>
      <input type="text" name="taskName" placeholder="Task name..." value="${oldName || ''}" autofocus />
      <input type="date" name="dueDate" value="${oldDueDate || ''}" />
      <div class="modal-buttons">
        <button class="save-btn">Save</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.save-btn').addEventListener('click', () => {
    const name = modal.querySelectorAll('input')[0].value.trim();
    const dueDate = modal.querySelectorAll('input')[1].value;
    if (name && dueDate) {
      onSubmit(name, dueDate);
      document.body.removeChild(modal);
    }
  });

  modal.querySelector('.cancel-btn').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
}

function openProjectPopup() {
  openInputModal('New Project', '', async (projectName) => {
    if (projectName) {
      await createProject(projectName);
    }
  });
}

function openTaskPopup() {
  openTaskModal('', '', async (taskName, dueDate) => {
    if (taskName && dueDate) {
      await createTask(taskName, dueDate);
    }
  });
}

// SPARKLES
window.startSparkles = function () {
  const canvas = document.getElementById('sparkleCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 1;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random();
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168, 85, 247, ${this.opacity})`;
      ctx.fill();
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animate);
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < 120; i++) {
      particles.push(new Particle());
    }
  }

  initParticles();
  animate();
};

// INIT
handleRedirect();
startSparkles();