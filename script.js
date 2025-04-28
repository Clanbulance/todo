// Initialize Supabase connection
// Clean up Supabase OAuth hash from URL after login
if (window.location.hash.includes('access_token')) {
  const params = new URLSearchParams(window.location.hash.substring(1));
  const access_token = params.get('access_token');

  if (access_token) {
    // Supabase client will already process it, no need to store manually

    // Clean the URL (remove the ugly #access_token part)
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}



const supabaseUrl = 'https://kcijljeifwpemznezyam.supabase.co';   // 👈 Your URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjaWpsamVpZndwZW16bmV6eWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MDAxOTcsImV4cCI6MjA2MTI3NjE5N30.11fHMwRwZPtmQHVErEoJyROgim3eNy3XNL5DxPJd574'; // 👈 Your anon key
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);


let currentUser = null;
let projects = [];
let selectedProject = null;

// Auth Check
async function checkSession() {
  const { data, error } = await supabase.auth.getSession();

  if (data.session) {
    currentUser = data.session.user;
    document.getElementById('authPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'grid';
    loadProjects();
  } else {
    console.log('No active session');
  }
}
checkSession();

// Login with Google
document.getElementById('googleLoginButton').addEventListener('click', loginWithGoogle);

async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
  if (error) showMessage('Google Login Error: ' + error.message);
}

// Spinner Control
function showSpinner() {
  document.getElementById('spinner').style.display = 'block';
}
function hideSpinner() {
  document.getElementById('spinner').style.display = 'none';
}

// Load Projects
async function loadProjects() {
  showSpinner();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', currentUser.id);
  hideSpinner();

  if (error) {
    console.error('Error loading projects:', error);
    showMessage('Failed to load projects!');
    return;
  }

  projects = data || [];
  renderProjects();
}

// Render Projects Sidebar
async function renderProjects() {
  if (!currentUser) return;

  const left = document.querySelector('.sidebar');
  left.innerHTML = '';

  const profilePic = document.createElement('img');
  profilePic.src = currentUser.user_metadata?.avatar_url || 'https://via.placeholder.com/80?text=User';
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

  // Loop through each project
  for (const project of projects) {
    const div = document.createElement('div');
    div.className = 'project';
    if (selectedProject && selectedProject.id === project.id) {
      div.classList.add('active');
    }

    // Fetch how many open tasks
    const { data: taskCount, error } = await supabase
      .from('tasks')
      .select('id', { count: 'exact' })
      .eq('project_id', project.id)
      .eq('is_finished', false);

    const openTasks = taskCount?.length || 0;

    div.innerHTML = `
      ${project.name}
      <span class="task-count">${openTasks}</span>
      <br>
      <button onclick="editProject('${project.id}', '${project.name}')" class="small-btn">✏️</button>
      <button onclick="deleteProject('${project.id}')" class="small-btn" style="background-color:#ef4444;">🗑️</button>
    `;

    div.addEventListener('click', () => {
      selectedProject = project;
      loadTasksForProject(project.id);
    });

    left.appendChild(div);
  }

  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'Logout';
  logoutBtn.className = 'add-project-btn';
  logoutBtn.style.backgroundColor = '#ef4444';
  logoutBtn.style.marginTop = '20px';
  logoutBtn.addEventListener('click', logoutUser);
  left.appendChild(logoutBtn);
}


// Open Project Popup
function openProjectPopup() {
  openPopup(`
    <h2>Add Project</h2>
    <input type="text" id="popupProjectName" class="popupInput" placeholder="Project name">
    <br><br>
    <button id="popupCreateProject" class="primary-btn">Create</button>
    <button id="popupCancel" class="primary-btn">Cancel</button>
  `);

  document.getElementById('popupCreateProject').addEventListener('click', async () => {
    const name = document.getElementById('popupProjectName').value.trim();
    if (!name) return showMessage('Project name required!');
    await supabase.from('projects').insert([{ name, user_id: currentUser.id }]);
    closePopup();
    loadProjects();
  });

  document.getElementById('popupCancel').addEventListener('click', closePopup);
}

// Edit Project
window.editProject = function(projectId, projectName) {
  openPopup(`
    <h2>Edit Project</h2>
    <input type="text" id="projectNameInput" class="popupInput" value="${projectName}">
    <br><br>
    <button id="updateProjectButton" class="primary-btn">Update</button>
    <button id="popupCancel" class="primary-btn">Cancel</button>
  `);

  document.getElementById('updateProjectButton').addEventListener('click', async () => {
    const newName = document.getElementById('projectNameInput').value.trim();
    if (!newName) return showMessage('Project name required!');
    await supabase.from('projects').update({ name: newName }).eq('id', projectId);
    closePopup();
    loadProjects();
  });

  document.getElementById('popupCancel').addEventListener('click', closePopup);
};

// Delete Project
window.deleteProject = async function(projectId) {
  if (!confirm('Are you sure you want to delete this project and its tasks?')) return;
  await supabase.from('tasks').delete().eq('project_id', projectId);
  await supabase.from('projects').delete().eq('id', projectId);
  loadProjects();
};

// Load Tasks
async function loadTasksForProject(projectId) {
  showSpinner();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId);
  hideSpinner();

  if (error) {
    console.error('Error loading tasks:', error);
    showMessage('Failed to load tasks!');
    return;
  }

  renderTasks(data || []);
}

// Render Tasks
function renderTasks(tasks) {
  const right = document.querySelector('.main');
  right.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = selectedProject.name;
  right.appendChild(title);

  const addTaskBtn = document.createElement('button');
  addTaskBtn.textContent = '+ Add Task';
  addTaskBtn.className = 'primary-btn';
  addTaskBtn.style.marginLeft = '20px';
  addTaskBtn.addEventListener('click', openTaskPopup);
  right.appendChild(addTaskBtn);

  // Split open and finished tasks
  const openTasks = tasks.filter(task => !task.is_finished);
  const finishedTasks = tasks.filter(task => task.is_finished);

  // Create Open Tasks Section
  const openSectionTitle = document.createElement('h3');
  openSectionTitle.textContent = "Open Tasks";
  openSectionTitle.style.marginTop = "30px";
  right.appendChild(openSectionTitle);

  const openTaskGrid = document.createElement('div');
  openTaskGrid.className = 'tasks-grid';
  right.appendChild(openTaskGrid);

  openTasks.forEach(task => {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task';
    taskDiv.innerHTML = `
      <strong>${task.task_name}</strong><br>
      Due: ${task.due_date}<br>
      Status: ❌ Not Finished
      <br><button onclick="finishTask('${task.id}')">Mark as Finished</button>
      <button onclick="editTask('${task.id}', '${task.task_name}', '${task.due_date}')">Edit</button>
    `;
    openTaskGrid.appendChild(taskDiv);
  });

  // Create Finished Tasks Section
  if (finishedTasks.length > 0) {
    const finishedSectionTitle = document.createElement('h3');
    finishedSectionTitle.textContent = "Finished Tasks";
    finishedSectionTitle.style.marginTop = "50px";
    right.appendChild(finishedSectionTitle);

    const finishedTaskGrid = document.createElement('div');
    finishedTaskGrid.className = 'tasks-grid';
    right.appendChild(finishedTaskGrid);

    finishedTasks.forEach(task => {
      const taskDiv = document.createElement('div');
      taskDiv.className = 'task';
      taskDiv.innerHTML = `
        <strong>${task.task_name}</strong><br>
        Due: ${task.due_date}<br>
        Status: ✅ Finished
      `;
      finishedTaskGrid.appendChild(taskDiv);
    });
  }
}


// Open Task Popup
function openTaskPopup() {
  openPopup(`
    <h2>Add Task</h2>
    <input type="text" id="taskNameInput" class="popupInput" placeholder="Task name">
    <input type="date" id="taskDueDateInput" class="popupInput">
    <br><br>
    <button id="saveTaskButton" class="primary-btn">Save</button>
    <button id="popupCancel" class="primary-btn">Cancel</button>
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

// Mark Task as Finished
window.finishTask = async function(taskId) {
  await supabase.from('tasks').update({ is_finished: true }).eq('id', taskId);
  loadTasksForProject(selectedProject.id);
};

// Edit Task
window.editTask = function(taskId, taskName, dueDate) {
  openPopup(`
    <h2>Edit Task</h2>
    <input type="text" id="taskNameInput" class="popupInput" value="${taskName}">
    <input type="date" id="taskDueDateInput" class="popupInput" value="${dueDate}">
    <br><br>
    <button id="updateTaskButton" class="primary-btn">Update</button>
    <button id="popupCancel" class="primary-btn">Cancel</button>
  `);

  document.getElementById('updateTaskButton').addEventListener('click', async () => {
    const newName = document.getElementById('taskNameInput').value.trim();
    const newDueDate = document.getElementById('taskDueDateInput').value;
    if (!newName || !newDueDate) return showMessage('Fill in all fields!');
    await supabase.from('tasks').update({ task_name: newName, due_date: newDueDate }).eq('id', taskId);
    closePopup();
    loadTasksForProject(selectedProject.id);
  });

  document.getElementById('popupCancel').addEventListener('click', closePopup);
};

// Popup Utility
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

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
  overlay.style.backdropFilter = 'blur(5px)';
  overlay.style.zIndex = '1000';
  overlay.addEventListener('click', closePopup);
  document.body.appendChild(overlay);
}

function showMessage(messageText) {
  openPopup(`
    <h2>${messageText}</h2>
    <br>
    <button id="popupOk" class="primary-btn">OK</button>
  `);
  document.getElementById('popupOk').addEventListener('click', closePopup);
}

// Logout
async function logoutUser() {
  await supabase.auth.signOut();
  currentUser = null;
  projects = [];
  selectedProject = null;
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('authPage').style.display = 'flex';
}

// Sparkles background animation
window.startSparkles = function() {
  const canvas = document.getElementById('sparkleCanvas');
  const ctx = canvas.getContext('2d');

  let particlesArray = [];
  let canvasWidth = window.innerWidth;
  let canvasHeight = window.innerHeight;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  class Particle {
    constructor() {
      this.x = Math.random() * canvasWidth;
      this.y = Math.random() * canvasHeight;
      this.size = Math.random() * 2 + 1;
      this.speedX = (Math.random() - 0.5) * 0.5;
      this.speedY = (Math.random() - 0.5) * 0.5;
      this.opacity = Math.random();
      this.fadeDirection = Math.random() > 0.5 ? 1 : -1;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > canvasWidth) this.speedX *= -1;
      if (this.y < 0 || this.y > canvasHeight) this.speedY *= -1;
      this.opacity += this.fadeDirection * 0.01;
      if (this.opacity >= 1) this.fadeDirection = -1;
      if (this.opacity <= 0.1) this.fadeDirection = 1;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168, 85, 247, ${this.opacity})`;
      ctx.fill();
    }
  }

  function initParticles() {
    particlesArray = [];
    for (let i = 0; i < 120; i++) {
      particlesArray.push(new Particle());
    }
  }

  function connectParticles() {
    for (let a = 0; a < particlesArray.length; a++) {
      for (let b = a; b < particlesArray.length; b++) {
        const dx = particlesArray[a].x - particlesArray[b].x;
        const dy = particlesArray[a].y - particlesArray[b].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 100) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(168, 85, 247, ${1 - distance / 100})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
          ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    particlesArray.forEach(p => {
      p.update();
      p.draw();
    });
    connectParticles();
    requestAnimationFrame(animate);
  }

  initParticles();
  animate();

  window.addEventListener('resize', () => {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    initParticles();
  });
};

window.startSparkles();
