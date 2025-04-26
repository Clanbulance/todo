// Initialize Supabase connection

const supabaseUrl = 'https://kcijljeifwpemznezyam.supabase.co';   // 👈 Your URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjaWpsamVpZndwZW16bmV6eWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MDAxOTcsImV4cCI6MjA2MTI3NjE5N30.11fHMwRwZPtmQHVErEoJyROgim3eNy3XNL5DxPJd574'; // 👈 Your anon key
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);


let currentUser = null;
let projects = [];
let selectedProject = null;

// Popups
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
  overlay.style.animation = 'fadeInOverlay 0.3s ease';
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
  popup.style.background = 'white';
  popup.style.padding = '30px';
  popup.style.borderRadius = '12px';
  popup.style.zIndex = '1001';
  popup.style.animation = 'fadeIn 0.3s ease';
  popup.innerHTML = content;
  document.body.appendChild(popup);
}

function closePopup() {
  const popup = document.getElementById('popup');
  const overlay = document.getElementById('overlay');
  if (popup) popup.remove();
  if (overlay) overlay.remove();
}

// Show nice messages
function showMessage(msg) {
  openPopup(`
    <h3>${msg}</h3>
    <button id="messageOkButton">OK</button>
  `);
  document.getElementById('messageOkButton').addEventListener('click', closePopup);
}

// Hash password
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Login/Register
document.getElementById('loginButton').addEventListener('click', () => {
  openPopup(`
    <h2>Login</h2>
    <input type="text" id="popupUsername" placeholder="Username" class="popupInput">
    <input type="password" id="popupPassword" placeholder="Password" class="popupInput">
    <button id="popupLoginConfirm">Login</button>
    <button id="popupCancel">Cancel</button>
  `);

  document.getElementById('popupLoginConfirm').addEventListener('click', handleLogin);
  document.getElementById('popupCancel').addEventListener('click', closePopup);
});

document.getElementById('registerButton').addEventListener('click', () => {
  openPopup(`
    <h2>Register</h2>
    <input type="text" id="popupUsername" placeholder="Username" class="popupInput">
    <input type="password" id="popupPassword" placeholder="Password" class="popupInput">
    <button id="popupRegisterConfirm">Register</button>
    <button id="popupCancel">Cancel</button>
  `);

  document.getElementById('popupRegisterConfirm').addEventListener('click', handleRegister);
  document.getElementById('popupCancel').addEventListener('click', closePopup);
});

async function handleLogin() {
  const username = document.getElementById('popupUsername').value.trim().toLowerCase();
  const password = document.getElementById('popupPassword').value;
  if (!username || !password) return showMessage('Fill all fields!');
  const hashedPassword = await hashPassword(password);
  const { data, error } = await supabase.from('users').select('*').eq('username', username).single();
  if (error || !data) return showMessage('User not found!');
  if (data.password_hash !== hashedPassword) return showMessage('Wrong password!');
  currentUser = data;
  document.getElementById('authPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'grid';
  closePopup();
  loadProjects();
}

async function handleRegister() {
  const username = document.getElementById('popupUsername').value.trim().toLowerCase();
  const password = document.getElementById('popupPassword').value;
  if (!username || !password) return showMessage('Fill all fields!');
  const hashedPassword = await hashPassword(password);
  const { data, error } = await supabase.from('users').insert([{ username, password_hash: hashedPassword }]);
  if (error) return showMessage('Register failed!');
  showMessage('Registered! You can now login.');
  closePopup();
}

// Projects
async function loadProjects() {
  const { data, error } = await supabase.from('projects').select('*').eq('user_id', currentUser.id);
  if (error) console.error(error);
  projects = data || [];
  addB(projects);
}

function addB(array) {
    const left = document.querySelector('.left');
    left.innerHTML = `
      <button id="logoutButton">Logout</button>
      <div id="AddButton">+</div> <!-- here -->
    `;
  
    document.getElementById('logoutButton').addEventListener('click', logoutUser);
    document.getElementById('AddButton').addEventListener('click', openProjectPopup);
  
    genFromArray(array);
  }
  

  function genFromArray(array) {
    array.forEach((project) => {
      const div = document.createElement('div');
      div.className = 'project'; // whole div is the button
  
      div.innerHTML = `
        <div class="projectName">${project.name}</div>
        <button class="deleteProjectBtn">❌</button>
      `;
  
      div.addEventListener('click', () => {
        selectedProject = project;
        loadTasksForProject(project.id);
      });
  
      div.querySelector('.deleteProjectBtn').addEventListener('click', (e) => {
        e.stopPropagation(); // Important!! prevent delete button from triggering project click
        deleteProject(project.id);
      });
  
      document.querySelector('.left').appendChild(div);
    });
  }
  
  

async function deleteProject(id) {
  if (!confirm('Delete project and all tasks?')) return;
  await supabase.from('tasks').delete().eq('project_id', id);
  await supabase.from('projects').delete().eq('id', id);
  loadProjects();
}

function openProjectPopup() {
  openPopup(`
    <h2>Add Project</h2>
    <input type="text" id="popupProjectName" class="popupInput" placeholder="Project name">
    <button id="popupCreateProject">Create</button>
    <button id="popupCancel">Cancel</button>
  `);

  document.getElementById('popupCreateProject').addEventListener('click', () => {
    const name = document.getElementById('popupProjectName').value.trim();
    if (!name) return showMessage('Project name required!');
    saveNewProject(name);
    closePopup();
  });

  document.getElementById('popupCancel').addEventListener('click', closePopup);
}

async function saveNewProject(name) {
  await supabase.from('projects').insert([{ name, user_id: currentUser.id }]);
  loadProjects();
}

// Tasks
async function loadTasksForProject(projectId) {
  const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId);
  if (error) console.error(error);
  renderTasks(data || []);
}

function renderTasks(tasks) {
    const rightArea = document.querySelector(".right");
  
    // Clear the right side
    rightArea.innerHTML = '';
  
    // Project Title
    const projectTitle = document.createElement('h2');
    projectTitle.textContent = selectedProject.name;
    rightArea.appendChild(projectTitle);
  
    // Add Task Button
    const addTaskButton = document.createElement('button');
    addTaskButton.textContent = '+ Add Task';
    addTaskButton.style.margin = '20px 0';
    addTaskButton.addEventListener('click', openTaskPopup);
    rightArea.appendChild(addTaskButton);
  
    // Task List Container
    const taskList = document.createElement('div');
    taskList.id = 'taskList';
    rightArea.appendChild(taskList);
  
    // Render each task as a card
    tasks.forEach((task) => {
      const taskDiv = document.createElement('div');
      taskDiv.className = 'task'; // This class is styled as a "card" in your CSS!
  
      taskDiv.innerHTML = `
        <strong>${task.task_name}</strong> <br> 
        Due: ${task.due_date} <br> 
        Status: ${task.is_finished ? '✅ Finished' : '❌ Not Finished'}
        <div style="margin-top: 10px;">
          ${task.is_finished ? '' : `<button onclick="finishTask('${task.id}')">Mark as Finished</button>`}
        </div>
      `;
  
      taskList.appendChild(taskDiv);
    });
  }
  
  

function openTaskPopup() {
  openPopup(`
    <h2>Add Task</h2>
    <input type="text" id="taskNameInput" class="popupInput" placeholder="Task name">
    <input type="date" id="taskDueDateInput" class="popupInput">
    <button id="saveTaskButton">Save</button>
    <button id="popupCancel">Cancel</button>
  `);

  document.getElementById('saveTaskButton').addEventListener('click', () => {
    const name = document.getElementById('taskNameInput').value.trim();
    const date = document.getElementById('taskDueDateInput').value;
    if (!name || !date) return showMessage('Fill both fields!');
    saveNewTask(name, date);
    closePopup();
  });

  document.getElementById('popupCancel').addEventListener('click', closePopup);
}

async function saveNewTask(name, date) {
  await supabase.from('tasks').insert([{ task_name: name, due_date: date, is_finished: false, project_id: selectedProject.id }]);
  loadTasksForProject(selectedProject.id);
}

window.finishTask = async function(taskId) {
    const { error } = await supabase
      .from('tasks')
      .update({ is_finished: true })
      .eq('id', taskId);
  
    if (error) {
      console.error(error);
      showMessage('Error finishing task.');
    } else {
      loadTasksForProject(selectedProject.id);
    }
  };
  
  

function logoutUser() {
  currentUser = null;
  projects = [];
  selectedProject = null;
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('authPage').style.display = 'flex';
}