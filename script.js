console.log("ver5")

// --- Clean URL if redirected from Supabase OAuth ---

const supabaseUrl = 'https://kcijljeifwpemznezyam.supabase.co';   // 👈 Your URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjaWpsamVpZndwZW16bmV6eWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MDAxOTcsImV4cCI6MjA2MTI3NjE5N30.11fHMwRwZPtmQHVErEoJyROgim3eNy3XNL5DxPJd574'; // 👈 Your anon key
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);


let currentUser = null;
let projects = [];
let selectedProject = null;

// Redirect to login page if no session found

// Function to redirect to login page only if the user is not already there

// Remove token from URL fragment after login
async function handleRedirect() {
  if (window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      console.log('Access token received:', access_token);
      
      await supabase.auth.setSession({
        access_token,
        refresh_token
      });

      console.log('Session set manually.');
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }

  checkSession();
}

// Call it immediately
handleRedirect();


// ✅ Always check session after page load
checkSession();

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



// --- Login with Google ---
document.getElementById('googleLoginButton').addEventListener('click', loginWithGoogle);

async function loginWithGoogle() {
  console.log('Starting Google login...');

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://clanbulance.github.io/todo'
    }
  });

  if (error) {
    console.error('Google Login Error:', error.message);
  } else {
    console.log('Login request sent successfully');
  }

  // Force session check after login request
  checkSession();
}

// --- Start Application ---
function startApp() {
  document.getElementById('authPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'grid';
  loadProjects();
}

// --- Load Projects ---
async function loadProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', currentUser.id);

  if (error) {
    console.error('Error loading projects:', error.message);
    return;
  }

  projects = data || [];
  renderProjects();
}

// --- Render Projects Sidebar ---
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

  for (const project of projects) {
    const div = document.createElement('div');
    div.className = 'project';
    if (selectedProject && selectedProject.id === project.id) {
      div.classList.add('active');
    }

    // Fetch how many open tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', project.id)
      .eq('is_finished', false);

    const openTasks = tasks?.length || 0;

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

// --- Open Project Popup ---
function openProjectPopup() {
  openInputModal('New Project', 'Enter Project Name...', (name) => {
    createProject(name);
  });
}


async function createProject(name) {
  await supabase.from('projects').insert([{ name, user_id: currentUser.id }]);
  loadProjects();
}

// --- Edit Project ---
async function editProject(id, oldName) {
  const newName = prompt('Edit Project Name:', oldName);
  if (newName) {
    await supabase.from('projects').update({ name: newName }).eq('id', id);
    loadProjects();
  }
}

// --- Delete Project ---
async function deleteProject(id) {
  if (confirm('Delete project and all its tasks?')) {
    await supabase.from('tasks').delete().eq('project_id', id);
    await supabase.from('projects').delete().eq('id', id);
    loadProjects();
  }
}

// --- Load Tasks ---
async function loadTasksForProject(projectId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId);

  if (error) {
    console.error('Error loading tasks:', error.message);
    return;
  }

  renderTasks(data || []);
}

// --- Render Tasks ---
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

  // Split open vs finished
  const openTasks = tasks.filter(task => !task.is_finished);
  const finishedTasks = tasks.filter(task => task.is_finished);

  const openTitle = document.createElement('h3');
  openTitle.textContent = 'Open Tasks';
  openTitle.style.marginTop = '30px';
  right.appendChild(openTitle);

  const openGrid = document.createElement('div');
  openGrid.className = 'tasks-grid';
  right.appendChild(openGrid);

  openTasks.forEach(task => {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task';
    taskDiv.innerHTML = `
      <strong>${task.task_name}</strong><br>
      Due: ${task.due_date}<br>
      Status: ❌ Not Finished
      <br>
      <button onclick="finishTask('${task.id}')">Finish</button>
      <button onclick="editTask('${task.id}', '${task.task_name}', '${task.due_date}')">Edit</button>
    `;
    openGrid.appendChild(taskDiv);
  });

  if (finishedTasks.length > 0) {
    const finishedTitle = document.createElement('h3');
    finishedTitle.textContent = 'Finished Tasks';
    finishedTitle.style.marginTop = '50px';
    right.appendChild(finishedTitle);

    const finishedGrid = document.createElement('div');
    finishedGrid.className = 'tasks-grid';
    right.appendChild(finishedGrid);

    finishedTasks.forEach(task => {
      const taskDiv = document.createElement('div');
      taskDiv.className = 'task';
      taskDiv.innerHTML = `
        <strong>${task.task_name}</strong><br>
        Due: ${task.due_date}<br>
        Status: ✅ Finished
      `;
      finishedGrid.appendChild(taskDiv);
    });
  }
}

// --- Open Task Popup ---
function openTaskPopup() {
  openTaskModal((name, dueDate) => {
    createTask(name, dueDate);
  });
}

function openTaskModal(onSubmit) {
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'custom-modal';

  // Create modal content
  modal.innerHTML = `
    <div class="custom-modal-content">
      <h2>New Task</h2>
      <input type="text" id="taskNameInput" placeholder="Task name..." />
      <input type="date" id="dueDateInput" />
      <div class="modal-buttons">
        <button id="modalSaveButton">Save</button>
        <button id="modalCancelButton">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Show modal with slight animation
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);

  // Button handlers
  document.getElementById('modalSaveButton').addEventListener('click', () => {
    const taskName = document.getElementById('taskNameInput').value.trim();
    const dueDate = document.getElementById('dueDateInput').value;

    if (taskName && dueDate) {
      onSubmit(taskName, dueDate);
      document.body.removeChild(modal);
    } else {
      alert('Please fill in both fields.');
    }
  });

  document.getElementById('modalCancelButton').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
}

// --- Helper to open a simple modal (for Project Name input) ---
function openInputModal(title, placeholder, onSubmit) {
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'custom-modal';

  // Create modal content
  modal.innerHTML = `
    <div class="custom-modal-content">
      <h2>${title}</h2>
      <input type="text" id="modalInput" placeholder="${placeholder}" />
      <div class="modal-buttons">
        <button id="modalSaveButton">Save</button>
        <button id="modalCancelButton">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Show modal animation
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);

  // Button handlers
  document.getElementById('modalSaveButton').addEventListener('click', () => {
    const input = document.getElementById('modalInput').value.trim();
    if (input) {
      onSubmit(input);
      document.body.removeChild(modal);
    }
  });

  document.getElementById('modalCancelButton').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
}


async function createTask(name, dueDate) {
  await supabase.from('tasks').insert([{ 
    task_name: name, 
    due_date: dueDate, 
    is_finished: false, 
    project_id: selectedProject.id 
  }]);
  loadTasksForProject(selectedProject.id);
}

window.finishTask = async function(id) {
  const { error } = await supabase.from('tasks').update({ is_finished: true }).eq('id', id);
  if (error) {
    console.error('Error finishing task:', error.message);
    alert('Failed to finish task!');
  } else {
    console.log('Task finished!');
    loadTasksForProject(selectedProject.id);
  }
};

window.editTask = async function(id, oldName, oldDueDate) {
  openEditTaskModal(oldName, oldDueDate, async (newName, newDueDate) => {
    const { error } = await supabase
      .from('tasks')
      .update({ 
        task_name: newName, 
        due_date: newDueDate 
      })
      .eq('id', id);
      
    if (error) {
      console.error('Error editing task:', error.message);
      alert('Failed to edit task!');
    } else {
      console.log('Task updated!');
      loadTasksForProject(selectedProject.id);
    }
  });
};


// --- Logout User ---
async function logoutUser() {
  await supabase.auth.signOut();
  window.location.reload();
}

// --- Sparkles Background ---
window.startSparkles = function() {
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
      if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
      if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
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

startSparkles();
checkSession();