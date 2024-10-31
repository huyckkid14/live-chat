let socket;
let notificationsEnabled = true; // Flag to control notification display
let lastNotification = null; // Variable to track the last notification content

let username;
let isAdmin = false; // Assume this is set correctly during login
let onlineUsers = new Set();
let isDiceRollMuted = true; // Track if dice roll announcements are muted
let typingTimeout;
let typingInterval;


const adminUsers = new Set(['huyckkid14', 'adminuser']); // Add admin usernames here
const badWords = ["shit", "fuck", "ass", "stupid", "hell"];
const replacement = "CHAT";

let activePoll = null; // Variable to store the current active poll
// Function to handle the poll command
function handlePollCommand(message) {
  // Match the /poll command, capturing the question and multiple options
  const pollCommand = message.match(/^\/poll "(.+?)"(.*)$/);

  if (pollCommand) {
    const question = pollCommand[1];
    const optionsString = pollCommand[2];

    // Match each option individually
    const options = optionsString.match(/"([^"]+)"/g).map(option => option.replace(/"/g, ''));

    if (options.length < 2) {
      displaySystemMessage("A poll needs at least two options.");
      return;
    }

    // Include the poll creator (username) in the poll message
    const pollCreator = username; // Ensure username is defined globally and holds the correct value

    // Send poll data to the server
    socket.send(JSON.stringify({
      type: 'poll',
      action: 'create',
      question: question,
      options: options,
      creator: pollCreator // Send the creator's username to the server
    }));
  }
}


// Function to create and display the poll
function createPoll(question, options, creator) {
  // Display "Created by" message before the poll
  displaySystemMessage(`Poll created by ${creator}:`);

  // Create the poll structure
  activePoll = {
    question: question,
    options: options.map(option => ({ text: option, votes: 0 })), // Initialize votes for each option
    voters: new Set() // Track who has voted to prevent multiple votes
  };

  // Display the poll
  displayPoll(); 
}

// Function to display the poll
function displayPoll() {
  let pollHtml = `<div class="poll">
    <h3>${activePoll.question}</h3>
    <ul>`;

  activePoll.options.forEach((option, index) => {
    pollHtml += `<li>
      <button onclick="vote(${index})">${option.text}</button> - <span id="votes-${index}">${option.votes}</span> votes
    </li>`;
  });

  pollHtml += `</ul>
    <button onclick="endPoll()">End Poll</button>
  </div>`;

  document.getElementById('messages').innerHTML += pollHtml; // Append the poll to the chat
}


// Function to display the poll
function displayPoll() {
  let pollHtml = `<div class="poll">
    <h3>${activePoll.question}</h3>
    <ul>`;

  activePoll.options.forEach((option, index) => {
    pollHtml += `<li>
      <button onclick="vote(${index})">${option.text}</button> - <span id="votes-${index}">${option.votes}</span> votes
    </li>`;
  });

  pollHtml += `</ul>
    <button onclick="endPoll()">End Poll</button>
  </div>`;

  document.getElementById('messages').innerHTML += pollHtml; // Append the poll to the chat
}

// Function to handle voting
function vote(optionIndex) {
  const currentUser = username; // Assume `username` is the current user's username

  if (activePoll.voters.has(currentUser)) {
    displaySystemMessage("You have already voted.");
    return;
  }

  // Send vote to the server
  socket.send(JSON.stringify({
    type: 'poll',
    action: 'vote',
    optionIndex: optionIndex,
    voter: currentUser
  }));
}

// Function to end the poll
function endPoll() {
  if (!activePoll) {
    return;
  }

  // Set activePoll to null to prevent further interactions
  activePoll = null;

  // Send end poll request to the server
  socket.send(JSON.stringify({
    type: 'poll',
    action: 'end'
  }));

  // Remove poll from the UI
  document.querySelector('.poll').remove(); // Assuming poll has a class 'poll'

  displaySystemMessage("The poll has ended.");
}

function sendImage() {
  const fileInput = document.getElementById('image-upload');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Please select an image to upload.');
    return;
  }

  // Show the warning modal
  document.getElementById('warning-modal').style.display = 'block';
}

// Handle the proceed action
function handleProceed() {
  const proceedInput = document.getElementById('proceed-input').value.trim();
  const fileInput = document.getElementById('image-upload');

  if (proceedInput.toLowerCase() === 'proceed') {
    // Proceed with the image upload
    const formData = new FormData();
    formData.append('image', fileInput.files[0]);

    fetch('/upload-image', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.imageUrl) {
        sendChatMessage(document.getElementById('to').value, `<img src="${data.imageUrl}" alt="User Image" style="max-width: 200px;">`);
      } else {
        alert('Failed to upload image.');
      }
    })
    .catch(error => {
      console.error('Error uploading image:', error);
    });
  } else {
    // Clear the file input if the user did not type "Proceed"
    fileInput.value = '';
  }

  // Hide the modal
  document.getElementById('warning-modal').style.display = 'none';
  document.getElementById('proceed-input').value = ''; // Clear the input field
}

(function() {
    var devtools = { open: false, orientation: null };
    var threshold = 160; // Threshold for detecting DevTools

    var check = function () {
        var widthThreshold = window.outerWidth - window.innerWidth > threshold;
        var heightThreshold = window.outerHeight - window.innerHeight > threshold;
        var orientation = widthThreshold ? 'vertical' : 'horizontal';

        if ((window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) || widthThreshold || heightThreshold) {
            if (!devtools.open || devtools.orientation !== orientation) {
                devtools.open = true;
                devtools.orientation = orientation;
            }
            if (!adminUsers.has(username)) {  // Always check if DevTools are open and the user is not an admin
                notifyAdminDevToolsOpened();  // Function to handle the notification logic
                window.location.href = 'http://turbochat.com:1010/dev-tools-detected.html'; // Redirect if DevTools are open
            }
        } else {
            if (devtools.open) {
                devtools.open = false;
                devtools.orientation = null;
            }
        }
    };

    // Function to notify the admin
    function notifyAdminDevToolsOpened() {
        fetch('/dev-tools-detected.html', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: username})
        }).then(response => {
            console.log('Admin notified about DevTools opening');
        }).catch(error => {
            console.error('Failed to notify admin:', error);
        });
    }

    check();
    window.addEventListener('resize', check);
    window.addEventListener('devtoolschange', check); // This assumes you have a way to detect DevTools changes
})();

function sanitizeMessage(message) {
  let sanitizedMessage = message;
  badWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitizedMessage = sanitizedMessage.replace(regex, replacement);
  });
  return sanitizedMessage;
}

function handleErrorMessage(errorMsg) {
  alert(errorMsg);
  // Optionally, you could disable the chat input or take other actions here
}
function sendMessage() {
  const to = document.getElementById('to').value;
  const message = document.getElementById('message').value;
  const sanitizedMessage = sanitizeMessage(message); // Sanitize the message
  if (to && sanitizedMessage) {
    if (to === 'system' || onlineUsers.has(to)) {
      sendChatMessage(to, sanitizedMessage);
    } else {
      const confirmed = confirm(`${to} is offline. Do you still want to send? The messages will be piled up.`);
      if (confirmed) {
        sendChatMessage(to, sanitizedMessage);
      }
    }
    document.getElementById('message').value = '';
  }
}

function handleJokeCommand(message) {
  const jokeCommand = message.match(/^\/joke$/); 
  if (jokeCommand) {
    const jokes = [
      "Why don't skeletons fight each other? They don't have the guts!",
      "Why was the math book sad? It had too many problems.",
      "Why don't eggs tell jokes? They might crack up!",
      "Why did the scarecrow win an award? Because he was outstanding in his field!",
      "What do you call fake spaghetti? An impasta!"
    ];

    // Pick a random joke from the array
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
  
    // Display the joke as a system message
    displaySystemMessage(randomJoke);
  }
}



function handleThemeCommand(message) {
  // Check if the message matches the /theme "theme" pattern
  const themeCommand = message.match(/^\/theme "(.+)"$/);

  if (themeCommand) {
    const theme = themeCommand[1].toLowerCase(); // Get the theme from the command
    if (["default", "night", "space", "beach"].includes(theme)) { // Check if the theme is valid
      changeTheme(theme); // Call the existing function to change the theme
      displaySystemMessage(`Theme changed to ${theme}.`); // Display a system message confirming the change
    } else {
      displaySystemMessage(`Invalid theme: "${theme}". Available themes: default, night, space, beach.`);
    }
  }
}


function sendChatMessage(to, message) {
    // Check if the message is a story command
    if (message.startsWith("/story start ")) {
        const storyTitle = message.match(/^\/story start "(.+)"$/)[1]; // Extract the story title
        socket.send(JSON.stringify({
            type: 'story',
            from: username,
            to: to,
            message: `${username} started the story! "${storyTitle}"`
        }));
    } else if (message.startsWith("/story continue ")) {
        const storyLine = message.match(/^\/story continue "(.+)"$/)[1]; // Extract the story line
        socket.send(JSON.stringify({
            type: 'story',
            from: username,
            to: to,
            message: `${username} continues the story! "${storyLine}"`
        }));
    } else if (message.startsWith("/story end")) {
        socket.send(JSON.stringify({
            type: 'story',
            from: username,
            to: 'everyone',
            message: `${username} ended the story!`
        }));
    } 
socket.send(JSON.stringify({ type: 'chat', from: username, to, message }));
  console.log('Sending message:', { to, message });
  handleThemeCommand(message);

  if (to === 'system') {
handleStoryCommand(message, username)
    handleJokeCommand(message);  // Call the joke handler
  handlePollCommand(message); // Check if message is a poll command
    const removeUserCommand = message.match(/^\/remove user (\S+) from SERVER$/);
    if (removeUserCommand && adminUsers.has(username)) {
      // Extract the username to remove
      const usernameToRemove = removeUserCommand[1];

      // Send a request to the server to remove the user
      fetch('/remove-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: usernameToRemove })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          displaySystemMessage(`${usernameToRemove} has been removed from the server.`);
        } else {
          displaySystemMessage(`Error removing user: ${data.message}`);
        }
      })
      .catch(error => {
        console.error('Error removing user:', error);
        displaySystemMessage('Error removing user.');
      });

      return; // Stop further processing
    }
    if (message === "/commands") {
      displaySystemMessage('Commands list');
      displaySystemMessage('/ban user username: Bans a certain user and forces them to log out');
      displaySystemMessage('/time-date: Displays the current date and time');
      displaySystemMessage('/ban p username "message" "countdown": Permanently bans a certain user, removes their data from the server, displays an error message with the admin message, and makes them wait for countdown seconds before signing up again. If countdown is not defined, it defaults to 5 seconds.');
      displaySystemMessage('/disable: Disables page for all non-admin users');
      displaySystemMessage('/enable: Enables page for all users');
      displaySystemMessage('/users: Lists all users that are signed up');
      displaySystemMessage('/notify admins "message": Notifies all logged in admins with "message."');
      displaySystemMessage('/everyone.send "message": Sends everyone "message"');
      displaySystemMessage('/dice 1, end number: Rolls a dice numbered through one to end number and tells everyone the result.');
      displaySystemMessage('/incognito: (admin only) Allows an admin to be not seen by other users even if online.');
      displaySystemMessage('/poll "question" "option 1" "option 2" "etc": Broadcasts a poll to everyone online.');
      displaySystemMessage('/joke: Displays a random joke to lighten the mood.');
}
else if (message === "/incognito" && adminUsers.has(username)) {
  // Send an incognito request to the server
  socket.send(JSON.stringify({ type: 'system', command: 'incognito', from: username }));
  displaySystemMessage('You are now in incognito mode.');
  return; // Stop further processing
}


    // Handle /everyone.send command
    const everyoneSendCommand = message.match(/^\/everyone\.send "(.+)"$/);
    if (everyoneSendCommand && adminUsers.has(username)) {
      displaySystemMessage('Alerting everyone...');
      const broadcastMessage = everyoneSendCommand[1];
      socket.send(JSON.stringify({ type: 'broadcast', message: broadcastMessage, from: username }));
      return; // Stop further processing
    }
    const diceCommand = message.match(/^\/dice 1, (\d+)$/);
    if (diceCommand) {
      const endNumber = parseInt(diceCommand[1], 10);

      if (endNumber > 1) {  // Ensure that the end number is greater than 1
        socket.send(JSON.stringify({ type: 'dice', endNumber: endNumber, from: username }));
      } else {
        displaySystemMessage('Error: The end number must be greater than 1.');
      }
      return; // Stop further processing
    }
    // Handle /mute diceRoll command
    if (message === '/mute diceRoll') {
      isDiceRollMuted = true;
      displaySystemMessage('You have muted dice roll announcements.');
      return; // Stop further processing
    }

    // Handle /unmute diceRoll command
    if (message === '/unmute diceRoll') {
      isDiceRollMuted = false;
      displaySystemMessage('You have unmuted dice roll announcements.');
      return; // Stop further processing
    }

    const notifyAdminsCommand = message.match(/^\/notify admins "(.+)"$/);
    if (notifyAdminsCommand && adminUsers.has(username)) {
      const adminMessage = notifyAdminsCommand[1];
      socket.send(JSON.stringify({ type: 'notifyAdmins', message: adminMessage, from: username }));
      return; // Stop further processing
    } else if (message.includes('/everyone.send') && adminUsers.has(username)) {
      displaySystemMessage('Forbidden: You need to be admin to use this command.');
    } else if (message.includes('/notify admins') && !adminUsers.has(username)) {
      displaySystemMessage('Forbidden: You need to be admin to use this command.');
    } else if (message.includes('/ban user') && !adminUsers.has(username)) {
      displaySystemMessage('Forbidden: You need to be admin to use this command.');
    } else if (!isValidCommand(message)) {
      const errorMsg = `Command Error: ${message} is not a defined command. Type "/commands" for list of commands`;
      displaySystemMessage(errorMsg);
      socket.send(JSON.stringify({ type: 'chat', to: 'system', message: errorMsg }));
    } else {
      socket.send(JSON.stringify({ type: 'chat', to, message }));
    }
  } else {
    socket.send(JSON.stringify({ type: 'chat', to, message }));
  }
}

let activeStory = null;

function startStory(title, username) {
    if (activeStory) {
        displaySystemMessage("There's already an active story! End the current story before starting a new one.");
        return;
    }

    // Create a new story object
    activeStory = {
        title: title,
        lines: [], // To store the lines of the story
        contributors: new Set() // To track contributors
    };

    displaySystemMessage(`${username} started a story! "${title}"`);
broadcastToEveryone(`${username} started the story! "${title}"`, username);
     broadcastToEveryone('storyActive', null, { title });
}

// Function to handle the `/story continue "line"` command
function continueStory(line, username) {
    if (!activeStory) {
        displaySystemMessage("There's no active story! Start one using /story start 'title'.");
        return;
    }

    // Add the line to the story and record the contributor
    activeStory.lines.push(line);
    activeStory.contributors.add(username);

    displaySystemMessage(`${username} continues the story! "${line}"`);
}

// Function to handle the `/story end` command
function endStory(username) {
    if (!activeStory) {
        displaySystemMessage("There's no active story to end!");
        return;
    }

    // Combine the story lines into a single string
    const fullStory = activeStory.lines.join(" ");
    
    // Display the full story
    displaySystemMessage(`${username} ended the story! Here is the complete story:\n"${activeStory.title}": ${fullStory}`);
    broadcastToEveryone(`${username} ended the story! Here is the complete story: "${activeStory.title}": ${fullStory}`, username);
    // Reset the story
    activeStory = null;
}

// Example command handler to demonstrate story handling
function handleStoryCommand(command, username) {
    const startCommand = command.match(/^\/story start "(.+)"$/);
    const continueCommand = command.match(/^\/story continue "(.+)"$/);
    const endCommand = command.match(/^\/story end$/);

    if (startCommand) {
        const title = startCommand[1];
        startStory(title, username);
    } else if (continueCommand) {
        const line = continueCommand[1];
        continueStory(line, username);
    } else if (endCommand) {
        endStory(username);
    } else {
        displaySystemMessage("Invalid story command.");
    }
}


function displaySystemMessage(message) {
  // Check if the message contains "opened dev tools"
  const isEmergency = message.toLowerCase().includes('opened dev tools');
  const messageClass = isEmergency ? 'emergency-message' : 'system-message'; // Choose class based on message content
  
  setTimeout(() => {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML += `<div class="${messageClass}"><strong>system:</strong> ${message}</div>`;
  }, 100);
}


function isValidCommand(message) {
  const validCommandPatterns = [
    /^\/ban user \S+$/,                 // Match "/ban user <username>"
    /^\/ban p user \S+.*$/,             // Match "/ban p user <username> "message""
    /^\/time-date$/,                    // Match "/time-date"
    /^\/disable$/,                      // Match "/disable"
    /^\/enable$/,                       // Match "/enable"
    /^\/users$/,                        // Match "/users"
    /^\/remove user \S+ from SERVER$/,  // Match "/remove user <username> from SERVER"
    /^\/notify admins ".*"$/,           // Match "/notify admins "message""
    /^\/everyone\.send "(.+)"$/,        // Match "/everyone.send('message')"
    /^\/dice 1, \d+$/,                  // Match "/dice 1, <end number>"
    /^\/incognito$/,                     // Match "/incognito" command
    /^\/poll "(.+)" "(.+)"$/,
    /^\/joke$/,
    /^\/story start ".*"$/,
    /^\/story continue ".*"$/,
    /^\/story end/
  ];

  return validCommandPatterns.some(pattern => pattern.test(message));
}

function isBanCommand(message) {
  const banCommandPattern = /^\/ban user \S+$/;
  return banCommandPattern.test(message);
}


document.addEventListener('DOMContentLoaded', (event) => {
  const rememberedUsername = localStorage.getItem('username');
  if (rememberedUsername) {
    document.getElementById('login-username').value = rememberedUsername;
  }
  checkSession();
});

function checkSession() {
  fetch('/session', {
    method: 'GET',
    credentials: 'include'
  })
  .then(response => response.json())
  .then(data => {
    if (data.systemDisabled && !data.isAdmin) {
      window.location.href = 'http://turbochat.com:1010/403.html';
    } else if (data.username) {
      username = data.username;
      startWebSocket();
      document.getElementById('login').style.display = 'none';
      document.getElementById('chat').style.display = 'block';
      document.getElementById('current-user').innerText = `Logged in as: ${username}`;
    } else {
      localStorage.removeItem('username');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    localStorage.removeItem('username');
  });
}
function signup() {
  const username = document.getElementById('signup-username').value;
  const password = document.getElementById('signup-password').value;
  
  fetch('/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  })
  .then(response => response.json())
  .then(data => {
    if (data.message === 'User created successfully') {
      triggerConfetti();
      setTimeout(() => {
  const termsModal = document.getElementById('terms-modal');
  const agreeButton = document.getElementById('agree-button');
  const scrollbox = document.querySelector('.scrollbox');

  // Show the modal when the user logs in (you might have logic for this)
  function showTermsModal() {
    termsModal.style.display = 'block';
  }

  // Check if the user has scrolled to the bottom of the scrollbox
function checkScroll() {
  const tolerance = 1; // Adjust this value if needed
  const isScrolledToBottom = scrollbox.scrollHeight - scrollbox.scrollTop <= scrollbox.clientHeight + tolerance;

  if (isScrolledToBottom) {
    agreeButton.innerText = 'Agree';
    agreeButton.disabled = false;
  } else {
    agreeButton.innerText = 'More';
    agreeButton.disabled = true;
  }
}


  // Listen for the scroll event
  scrollbox.addEventListener('scroll', checkScroll);

  // Call the function to show the modal after login
  showTermsModal();

  // Logic when Agree button is clicked
  agreeButton.addEventListener('click', () => {
    termsModal.style.display = 'none';
    // Additional logic after agreeing, e.g., allow user to proceed
  });
        alert('Signup successful! Please login.');
      }, 500);
      document.getElementById('signup').style.display = 'none';
      document.getElementById('login').style.display = 'block';
    } else {
      alert(data.message);
    }
  })
  .catch(error => console.error('Error:', error));
}

function triggerConfetti() {
  confetti({
    particleCount: 1000,
    spread: 200,
    origin: { y: 0.6 }
  });
}




// Show the modal when admin user logs in
function login() {
  username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const doNotRememberMe = document.getElementById('do-not-remember-me').checked;

  fetch('/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password }),
    credentials: 'include'
  })
  .then(response => response.json())
  .then(data => {
    if (data.message === 'Login successful') {
      if (adminUsers.has(username)) {
        isAdmin = true; // Set the isAdmin flag to true if the user is an admin
        showThemeModal(); // Show the theme modal for admin users
      } else {
        isAdmin = false; // Set the isAdmin flag to false if the user is not an admin
      }
      if (!doNotRememberMe) {
        localStorage.setItem('username', username);
      } else {
        localStorage.removeItem('username');
      }
      startWebSocket();
      document.getElementById('login').style.display = 'none';
      document.getElementById('chat').style.display = 'block';
      document.getElementById('current-user').innerText = `Logged in as: ${username}`;
    } else {
      alert(data.message);
    }
  })
  .catch(error => console.error('Error:', error));
}


function startWebSocket() {
  socket = new WebSocket('ws://turbochat.com:1010');
  
  socket.onopen = () => {
    console.log('WebSocket connection opened');
    socket.send(JSON.stringify({ type: 'login', name: username }));
  };
function showServerNotification(message) {
  const notificationDiv = document.getElementById('server-notification');
  notificationDiv.innerText = message;
  notificationDiv.style.display = 'block';

  // Hide the notification after 5 seconds
  setTimeout(() => {
    notificationDiv.style.display = 'none';
  }, 5000);
}
socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  const messagesDiv = document.getElementById('messages');
  if (msg.type === 'statusChange') {
    updateUserStatusGlobally(msg.username, msg.status);
  }	
    if (msg.type === 'storyActive') {
        // Update the client state to reflect that there is an active story
        activeStory = { title: msg.title, lines: [] };
        displaySystemMessage(`A new story has started: "${msg.title}"`);
    }
  if (msg.type === 'poll') {
    switch (msg.action) {
      case 'createdBy':
        // Display the "Created by" message
        displaySystemMessage(`Poll created by ${msg.creator}:`);
        break;


      case 'create':
        // Create and display the poll
        createPoll(msg.question, msg.options, msg.creator);
        break;

      case 'vote':
        updatePollVote(msg.optionIndex, msg.voter);
        break;

      case 'end':
        endPoll();
        break;

      default:
        console.log('Unknown poll action:', msg.action);
    }
  }

  // Skip server messages from this operation
  if (msg.type === 'systemDisabled' && !isAdmin) {
    window.location.href = 'http://turbochat.com:1010/403.html';
  } else if (msg.type === 'error') {
    handleErrorMessage(msg.message);
  } else if (msg.type === 'updateUsers') {
    onlineUsers = new Set(msg.users);
    updateOnlineUsers(msg.users);
  } else if (msg.type === 'typing' && msg.to === username) {
    showTypingIndicator(msg.from);
  } else if (msg.type === 'logoutAndClearData') {
      // Clear all local data when instructed by the server
      alert(msg.message);
      clearAllLocalData();
  } else if (msg.type === 'stopTyping' && msg.to === username) {
    hideTypingIndicator();
  } else if (msg.type === 'banned') {
    alert(`${msg.adminName} has banned you. Please log in again.`);
    logout();
    } else if (msg.type === 'permanentBan') {
        showPermanentBanMessage(msg.adminName, msg.adminMessage, msg.countdown);
        logout();
    } else if (msg.type === 'logout') {
    alert(msg.message);
    clearSessionData(); // Ensure local storage and session are cleared
    } else if (msg.type === 'diceResult') {
      if (!isDiceRollMuted) {
     displaySystemMessage(msg.message);
      }
    } else if (msg.type === 'chat') {
    // Delay the message deletion by 100 milliseconds
    /*if (msg.isAdmin && msg.from !== 'system') {
      setTimeout(() => {
        const messageNodes = messagesDiv.querySelectorAll('.admin-message, .user-message');
        if (messageNodes.length > 3) {
          for (let i = 0; i < 3; i++) {
            messagesDiv.removeChild(messageNodes[i]);
          }
        }
      }, 100);
    }*/

    const messageClass = msg.from === 'system' ? 'system-message' : (msg.isAdmin ? 'admin-message' : 'user-message');
    const adminPrefix = msg.isAdmin ? '[Admin] ' : '';

    messagesDiv.innerHTML += `<div class="${messageClass}"><strong>${adminPrefix}${msg.from} to ${msg.to}:</strong> ${msg.message}</div>`;
    if (msg.to === username && msg.from !== username) {
      showDesktopNotification(`New message from ${msg.from}`, msg.message);
    }
  }
};

// Function to update the poll with a new vote
function updatePollVote(optionIndex, voter) {
  if (!activePoll || activePoll.voters.has(voter)) {
    return; // Ignore if there's no active poll or the voter has already voted
  }

  activePoll.options[optionIndex].votes += 1; // Increment the vote count
  activePoll.voters.add(voter); // Add the voter to the list

  document.getElementById(`votes-${optionIndex}`).textContent = activePoll.options[optionIndex].votes; // Update vote count in the UI
}

function showPermanentBanMessage(adminName, adminMessage, countdown) {
    let countdownSeconds = countdown || 5; // Default to 5 seconds if not provided

    // Create the overlay
    const overlay = document.createElement('div');
    overlay.id = 'ban-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; 
    overlay.style.zIndex = '999';

    // Create the ban message
    const banMessage = document.createElement('div');
    banMessage.id = 'ban-message';
    banMessage.style.position = 'fixed';
    banMessage.style.top = '50%';
    banMessage.style.left = '50%';
    banMessage.style.transform = 'translate(-50%, -50%)';
    banMessage.style.backgroundColor = 'red';
    banMessage.style.padding = '20px';
    banMessage.style.color = 'white';
    banMessage.style.fontSize = '20px';
    banMessage.style.textAlign = 'center';
    banMessage.style.zIndex = '1000';

    function updateBanMessage() {
        if (countdownSeconds > 0) {
            banMessage.innerHTML = `ERROR<br>${adminName} has banned you permanently.<br>${adminMessage}<br>Please wait ${countdownSeconds} seconds and then sign up again.`;
            countdownSeconds--;
        } else {
            document.body.removeChild(banMessage);
            document.body.removeChild(overlay);
        }
    }

    // Append overlay and ban message to the body
    document.body.appendChild(overlay);
    document.body.appendChild(banMessage);

    updateBanMessage();
    const countdownInterval = setInterval(() => {
        if (countdownSeconds >= 0) {
            updateBanMessage();
        } else {
            clearInterval(countdownInterval);
        }
    }, 1000);
}



  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onclose = () => {
    console.log('WebSocket connection closed');
    clearSessionData();
  };
}

function updateOnlineUsers(users) {
  const isAdminOnline = users.some(user => adminUsers.has(user));
  if (isAdminOnline) {
    document.getElementById('admin-duty').style.display = 'block';
  } else {
    document.getElementById('admin-duty').style.display = 'none';
  }

  const onlineUsersList = document.getElementById('online-users');
  onlineUsersList.innerHTML = '';
  users.forEach(user => {
    const userItem = document.createElement('li');

    // Check if the user is an admin
    if (adminUsers.has(user)) {
      userItem.textContent = `🔧 ${user}`; // Add the wrench emoji before the admin user's name
    } else {
      userItem.textContent = user;
      userItem.setAttribute('data-username', user);
    }

    // Add a ban button if the logged-in user is an admin and the user isn't an admin
    if (adminUsers.has(username) && !adminUsers.has(user)) {
      const banButton = document.createElement('button');
      banButton.textContent = 'Ban';
      banButton.onclick = () => banUser(user);
      userItem.appendChild(banButton);
    }

    onlineUsersList.appendChild(userItem);
  });
}

function banUser(userToBan) {
  if (confirm(`Are you sure you want to ban ${userToBan}?`)) {
    socket.send(JSON.stringify({ type: 'ban', user: userToBan }));
  }
}

function logout() {
  fetch('/logout', {
    method: 'POST',
    credentials: 'include'
  })
  .then(response => response.json())
  .then(data => {
    if (data.message === 'Logout successful') {
      clearSessionData();
    } else {
      alert('Logout failed');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    clearSessionData();
  });
}

function clearSessionData() {
  if (socket) {
    socket.close();
  }
  localStorage.removeItem('username');
  document.getElementById('chat').style.display = 'none';
  document.getElementById('login').style.display = 'block';
  document.getElementById('current-user').innerText = '';
}

document.getElementById('message').addEventListener('input', () => {
  const to = document.getElementById('to').value;
  
  // Clear any existing timeouts
  if (typingTimeout) clearTimeout(typingTimeout);
  
  // If typing indicator isn't shown, show it immediately
  if (!typingInterval) {
    socket.send(JSON.stringify({ type: 'typing', from: username, to: to }));
    showTypingIndicator(username);
  }
  
  // Set a new timeout
  typingTimeout = setTimeout(() => {
    socket.send(JSON.stringify({ type: 'stopTyping', from: username, to: to }));
    hideTypingIndicator();
  }, 1000);
});

function showTypingIndicator(user) {
  const typingIndicator = document.getElementById('typing-indicator');			
  typingIndicator.style.display = 'block';
  let dots = 0;

  // Clear any existing interval
  if (typingInterval) clearInterval(typingInterval);

  // Create a new interval to cycle the dots
  typingInterval = setInterval(() => {
    dots = (dots + 1) % 4; // Cycle through 0, 1, 2, 3
    typingIndicator.innerText = `${user} is typing${'.'.repeat(dots)}`;
  }, 300);
}

function hideTypingIndicator() {
  const typingIndicator = document.getElementById('typing-indicator');
  typingIndicator.style.display = 'none';
  if (typingInterval) {
    clearInterval(typingInterval);
    typingInterval = null;
  }
}

function clearAllLocalData() {
  // Clear local storage
  localStorage.clear();

  // Clear session storage
  sessionStorage.clear();

  // Clear all cookies
  const cookies = document.cookie.split(';');

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }

  console.log('All local data has been cleared.');
}

document.addEventListener('DOMContentLoaded', (event) => {
  const rememberedUsername = localStorage.getItem('username');

  // If there's a remembered username, check if it still exists on the server
  if (rememberedUsername) {
    checkUserInDatabase(rememberedUsername);
  } else {
    clearSessionData(); // No username found in local storage, clear session data
  }
});

// Function to check if the user exists in the database
function checkUserInDatabase(username) {
  fetch(`/check-user?username=${encodeURIComponent(username)}`, {
    method: 'GET',
    credentials: 'include'
  })
    .then(response => response.json())
    .then(data => {
      if (!data.exists) {
        // If user does not exist in the database, log them out
        alert('Your account no longer exists on the server. You have been logged out.');
        clearSessionData();
      } else {
        // Proceed with normal operations if the user exists
        checkSession(); // Check session validity after confirming user exists
      }
    })
    .catch(error => {
      console.error('Error checking user existence in database:', error);
      clearSessionData();
    });
}
let recorder;
let audioStream; // Variable to hold the MediaStream object

function startRecording() {
  // Check for Internet Explorer, Edge, or unsupported browsers
  if (typeof DetectRTC !== 'undefined' && (DetectRTC.browser.name === 'IE' || DetectRTC.browser.name === 'Edge') || !navigator.mediaDevices) {
    alert('Using Flash fallback for voice recording.');

    // Use RecordRTC with Flash fallback
    recorder = RecordRTC({ type: 'audio', mimeType: 'audio/wav', bufferSize: 2048 });

    // Start recording with Flash fallback
    recorder.startRecording();
  } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    // Use getUserMedia for modern browsers
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function(stream) {
        audioStream = stream; // Store the MediaStream object in the audioStream variable
        recorder = RecordRTC(audioStream, { type: 'audio' });
        recorder.startRecording();
        document.getElementById('stop-record-btn').style.display = 'inline'; // Show stop button
        document.getElementById('record-btn').disabled = true; // Disable start button
      })
      .catch(function(error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access your microphone. Please check your browser settings.');
      });
  } else {
    alert('Your browser does not support audio recording. Please try a different browser.');
  }
}

// Function to stop recording
// Function to stop recording
function stopRecording() {
  if (recorder) {
    recorder.stopRecording(function() {
      const blob = recorder.getBlob();
      const audioUrl = URL.createObjectURL(blob);
      const audioPreview = document.getElementById('audio-preview');
      
      // Use src instead of srcObject since audioUrl is a blob URL
      audioPreview.src = audioUrl;
      audioPreview.style.display = 'block'; // Show audio preview
      document.getElementById('send-voice-btn').style.display = 'inline'; // Show send button
      document.getElementById('record-btn').disabled = false; // Re-enable start button
      document.getElementById('stop-record-btn').style.display = 'none'; // Hide stop button

      // Send the audio message
      sendAudioMessage(blob);
    });
  }
}


let recordedAudioBlob; // Variable to hold the recorded audio

function stopRecording() {
  if (recorder) {
    recorder.stopRecording(function () {
      recordedAudioBlob = recorder.getBlob(); // Store the blob in a variable
      const audioUrl = URL.createObjectURL(recordedAudioBlob);
      const audioPreview = document.getElementById('audio-preview');

      // Display the audio preview
      audioPreview.src = audioUrl;
      audioPreview.style.display = 'block';
      document.getElementById('send-voice-btn').style.display = 'inline'; // Show send button
      document.getElementById('record-btn').disabled = false; // Re-enable start button
      document.getElementById('stop-record-btn').style.display = 'none'; // Hide stop button
    });
  }
}


function sendVoiceMessage() {
  if (!recordedAudioBlob) {
    alert('No audio message recorded. Please record your message first.');
    return;
  }

  const formData = new FormData();
  formData.append('voiceMessage', recordedAudioBlob);

  fetch('/upload-voice', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.voiceUrl) {
      sendChatMessage(document.getElementById('to').value, `<audio controls src="${data.voiceUrl}"></audio>`);
      recordedAudioBlob = null; // Clear the blob after sending
    } else {
      alert('Failed to upload voice message.');
    }
  })
  .catch(error => {
    console.error('Error uploading voice message:', error);
  });
}




function requestNotificationPermission() {
  if ('Notification' in window) { // Check if the browser supports notifications
    if (Notification.permission === 'granted') {
      console.log('Notification permission already granted.');
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          console.log('Notification permission granted.');
          subscribeUserToPush(); // Call the function to subscribe the user to push notifications
        } else {
          console.log('Notification permission denied.');
        }
      }).catch((error) => {
        console.error('Error requesting notification permission:', error);
      });
    }
  } else {
    console.log('This browser does not support notifications.');
  }
}

if ('serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
        // Check and request notification permission
        requestNotificationPermission();
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}


function subscribeUserToPush() {
  navigator.serviceWorker.ready.then(function(registration) {
    const applicationServerKey = urlB64ToUint8Array('YOUR_PUBLIC_VAPID_KEY'); // Replace with your VAPID public key
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    })
    .then(function(subscription) {
      console.log('User is subscribed:', subscription);
      // Send subscription to your backend to store it and use for push notifications
    })
    .catch(function(error) {
      console.error('Failed to subscribe the user:', error);
    });
  });
}

// Helper function to convert VAPID key
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}


// Call the function to request notification permission when the page loads
document.addEventListener('DOMContentLoaded', () => {
  requestNotificationPermission();
});

// Function to observe for new system messages
function observeSystemMessages() {
  const messagesDiv = document.getElementById('messages');

  // Create a MutationObserver to watch for new system messages
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        // Check if a new system message was added
        mutation.addedNodes.forEach((node) => {
          if (node.classList && node.classList.contains('system-message')) {
            // Get the message text
            const messageText = node.innerText || node.textContent;
            // Show a desktop notification for the new system message
            showDesktopNotification('System Message', messageText);
          }
        });
      }
    }
  });

  // Start observing the messages container for changes
  observer.observe(messagesDiv, { childList: true, subtree: false });
}

// Global audio object
let audio; 

// Function to display a desktop notification
function showDesktopNotification(title, message) {
  // Check if notifications are enabled, supported, and permission is granted
  if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
    // Check if the message is different from the last notification
    if (message !== lastNotification) {
      let notificationIcon = '/turbochat_favicon.png'; // Default icon

      // Modify the title and message for emergency notifications
      if (message.includes("opened DevTools")) {
        title = `🚨 EMERGENCY`;
        message = `⚠️ New message from system: ${message} ⚠️`; // Add warning emojis to the message
        notificationIcon = '/warning.png'; // Use the warning icon

        // Initialize or reuse the audio object
        if (!audio) {
          audio = new Audio('alarm.wav'); // Replace with the path to your custom sound file
        }

        audio.play().catch(error => console.error('Failed to play audio:', error));
      }

      // Create the notification with the dynamically assigned icon
      const notification = new Notification(title, {
        body: message,
        icon: notificationIcon // Use the dynamically set icon
      });

      // Store the current message as the last notification
      lastNotification = message;

      // Handle the notification click event
      notification.onclick = () => {
        window.focus(); // Bring the tab into focus if the user clicks the notification

        // Stop the audio
        if (audio) {
          audio.pause();
          audio.currentTime = 0; // Reset audio to the beginning
        }
      };

      // Handle the notification close event
      notification.onclose = () => {
        notificationsEnabled = false; // Disable notifications
        setTimeout(() => {
          notificationsEnabled = true; // Re-enable notifications after 2 seconds
        }, 2000);
      };

      // Clear the last notification after a timeout (optional)
      setTimeout(() => {
        lastNotification = null;
      }, 5000); // Reset after 5 seconds
    }
  }
}
document.addEventListener('visibilitychange', () => {
  const status = document.visibilityState === 'hidden' ? 'inactive' : 'active';
  
  // Send the status update to the server
  socket.send(JSON.stringify({
    type: 'statusChange',
    username: username,
    status: status
  }));
});
function updateUserStatusGlobally(username, status) {
  const onlineUsersList = document.querySelectorAll('#online-users li');
  
  onlineUsersList.forEach(userItem => {
    const user = userItem.getAttribute('data-username');
    
    if (user === username) {
      if (status === 'inactive') {
        userItem.style.backgroundColor = 'yellow'; // Mark as inactive
        if (!userItem.textContent.includes(' (Inactive)')) {
          userItem.textContent += ' (Inactive)';
        }
      } else {
        userItem.style.backgroundColor = ''; // Mark as active
        userItem.textContent = userItem.textContent.replace(' (Inactive)', '');
      }
    }
  });
}

// Check if the browser supports SpeechRecognition
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if ('SpeechRecognition' in window) {
    // Initialize speech recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop after one result
    recognition.lang = 'en-US'; // Set language (can be customized)
    recognition.interimResults = false; // Wait for final result
    recognition.maxAlternatives = 1; // Only one result needed

    // Reference the input field and button
    const messageInput = document.getElementById('message');
    const ttsButton = document.getElementById('tts-btn');

    // Handle the result from the speech recognition
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript; // Get the recognized text
        messageInput.value = transcript; // Fill in the input with the spoken text
    };

    // Handle errors
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        alert('Error with speech recognition. Try again!');
    };

    // Handle button click to start speech recognition
    ttsButton.addEventListener('click', () => {
        recognition.start(); // Start listening
        console.log('Voice recognition activated. Start speaking...');
    });
} else {
    alert('Speech Recognition API is not supported in this browser.');
}


function showSignup() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('signup').style.display = 'block';
}

function showLogin() {
  document.getElementById('signup').style.display = 'none';
  document.getElementById('login').style.display = 'block';
}

