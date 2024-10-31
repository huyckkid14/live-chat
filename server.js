let systemDisabled = false;
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./users.db');
const fs = require('fs'); // Add at the top to work with the file system
const app = express();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Save uploaded images to the 'uploads' directory
const posts = new sqlite3.Database('./community.db'); // Renamed to 'posts'



// Use body-parser middleware
app.use(bodyParser.json());
// Initialize database if it does not exist
posts.run(
    `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
);

posts.run(
    `CREATE TABLE IF NOT EXISTS replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        postId INTEGER,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (postId) REFERENCES posts(id)
    )`
);

// Route to create a new post
app.post('/create-post', (req, res) => {
    const content = req.body.content;
    if (!content) {
        return res.status(400).json({ success: false, message: 'Content is required' });
    }

    posts.run(`INSERT INTO posts (content) VALUES (?)`, [content], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error saving post' });
        }

        const post = { id: this.lastID, content, timestamp: Date.now() };
        res.json({ success: true, post });
    });
});

// Route to create a reply to a post
app.post('/reply-post', (req, res) => {
    const { postId, reply } = req.body;
    if (!postId || !reply) {
        return res.status(400).json({ success: false, message: 'Post ID and reply content are required' });
    }

    posts.run(`INSERT INTO replies (postId, content) VALUES (?, ?)`, [postId, reply], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error saving reply' });
        }

        const replyData = { id: this.lastID, postId, content: reply, timestamp: Date.now() };
        res.json({ success: true, reply: replyData });
    });
});

// Route to get all posts with replies
app.get('/get-posts', (req, res) => {
    posts.all(`SELECT * FROM posts ORDER BY timestamp DESC`, [], (err, postRows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error retrieving posts' });
        }

        // Fetch replies for each post
        const postsWithReplies = postRows.map(post => {
            return new Promise((resolve, reject) => {
                posts.all(`SELECT * FROM replies WHERE postId = ? ORDER BY timestamp ASC`, [post.id], (err, replyRows) => {
                    if (err) {
                        reject(err);
                    } else {
                        post.replies = replyRows;
                        resolve(post);
                    }
                });
            });
        });

        // Resolve all promises and send response
        Promise.all(postsWithReplies)
            .then(posts => res.json(posts))
            .catch(err => res.status(500).json({ success: false, message: 'Error retrieving replies' }));
    });
});

app.post('/report-post', (req, res) => {
    const { postId, reason } = req.body;
    if (!postId || !reason) {
        return res.status(400).json({ success: false, message: 'Post ID and reason are required' });
    }

    // Retrieve the post content by its ID
    posts.get(`SELECT content FROM posts WHERE id = ?`, [postId], (err, post) => {
        if (err || !post) {
            return res.status(500).json({ success: false, message: 'Error retrieving post or post not found' });
        }

        // Broadcast report to admins without username
        const reportMessage = `New Reported Post: "${post.content}"\nReason: "${reason}"`;
        broadcastToAdmins(reportMessage);

        // Send response back to the user
        res.json({ success: true, message: 'Report submitted successfully' });
    });
});
app.delete('/delete-post/:id', (req, res) => {
    const postId = req.params.id;

    posts.run(`DELETE FROM posts WHERE id = ?`, [postId], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error deleting post' });
        }

        res.json({ success: true });
    });
});


// Route to get reported posts (Example with SQLite)
app.get('/get-reported-posts', (req, res) => {
    // Fetch all reported posts from the database
    db.all(`SELECT posts.id, posts.title, posts.content, reports.reason 
            FROM posts
            JOIN reports ON posts.id = reports.postId`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error fetching reported posts' });
        }
        res.json({ success: true, reportedPosts: rows });
    });
});


const nodemailer = require('nodemailer')
// Configure Nodemailer transport
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bestorangelover@gmail.com', // Replace with your Gmail address
        pass: 'esqw acle lagp fdgb'          // Replace with your Gmail app password (NOT your regular Gmail password)
    }
});

app.post('/unsubscribe', (req, res) => {
    const { email, options } = req.body;

    // Prepare the list of unsubscribed options
    const unsubscribeList = options.length > 0 ? options.join(', ') : "No options selected";

    // HTML email structure for the notification to support
    const unsubscribeHtml = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Unsubscribe Request</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
                    h2 { color: #4CAF50; }
                    footer { border-top: 1px solid #ddd; padding-top: 10px; color: #666; margin-top: 20px; }
                    a { color: #4CAF50; text-decoration: none; }
                </style>
            </head>
            <body>
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                    <h2>User Requests Unsubscription: ${email}</h2>
                    <p>Hello <strong>TurboChat Support</strong>,</p>
                    <p>The following user has requested to be unsubscribed from specific email communications:</p>
                    
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Unsubscribe from:</strong> ${unsubscribeList}</p>
                    
                    <footer>
                        <p>TurboChat © 2024</p>
                        <p>
                            <a href="http://localhost:1010">Home</a> | 
                            <a href="http://localhost:1010/terms-of-use">Terms of Use</a> | 
                            <a href="http://localhost:1010/privacy-policy">Privacy Policy</a>
                        </p>
                    </footer>
                </div>
            </body>
        </html>
    `;

    // Mail options for notifying support
    const supportMailOptions = {
        from: 'bestorangelover@gmail.com',
        to: 'bestorangelover@gmail.com',
        subject: `Unsubscribe Request from ${email}`,
        html: unsubscribeHtml
    };

    // HTML email for confirmation to the requester
    const userHtml = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Unsubscription Confirmation</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
                    h2 { color: #4CAF50; }
                    footer { border-top: 1px solid #ddd; padding-top: 10px; color: #666; margin-top: 20px; }
                    a { color: #4CAF50; text-decoration: none; }
                </style>
            </head>
            <body>
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                    <h2>Unsubscription Requested: ${email}</h2>
                    <p>Hello <strong>${email}</strong>,</p>
                    <p>You have requested to be unsubscribed from the following services:</p>
                    <p><strong>Unsubscribed from:</strong> ${unsubscribeList}</p>
                    <p>Please allow 2-4 business days for these changes to take effect. <strong>If you did not request the change, please contact support immediately.</strong></p>
                    
                    <footer>
                        <p>TurboChat © 2024</p>
                        <p>
                            <a href="http://localhost:1010">Home</a> | 
                            <a href="http://localhost:1010/terms-of-use">Terms of Use</a> | 
                            <a href="http://localhost:1010/privacy-policy">Privacy Policy</a> | 
                            <a href="http://localhost:1010/unsubscribe.html">Unsubscribe</a>
                        </p>
                    </footer>
                </div>
            </body>
        </html>
    `;

    // Mail options for confirmation to the user
    const userMailOptions = {
        from: 'bestorangelover@gmail.com',
        to: email,
        subject: 'Unsubscription Confirmation',
        html: userHtml
    };

    // Send both emails (one to support and one to the user)
    transporter.sendMail(supportMailOptions, (supportError, supportInfo) => {
        if (supportError) {
            console.error("Failed to send unsubscribe email to support:", supportError);
            return res.status(500).json({ message: 'Failed to process your request. Please try again.' });
        } else {
            console.log('Unsubscribe email sent to support:', supportInfo.response);

            // Send confirmation email to the user
            transporter.sendMail(userMailOptions, (userError, userInfo) => {
                if (userError) {
                    console.error("Failed to send unsubscribe confirmation to user:", userError);
                    return res.status(500).json({ message: 'Failed to send confirmation email.' });
                } else {
                    console.log('Unsubscribe confirmation sent to user:', userInfo.response);
                    return res.status(200).json({ message: 'Your unsubscription request has been submitted, and a confirmation email has been sent.' });
                }
            });
        }
    });
});



app.post('/send-email', (req, res) => {
    const { name, email, message } = req.body;
    const referenceNumber = Math.floor(100000 + Math.random() * 900000); // Generate a random reference number

    // Full HTML structure for the email body
    const emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Help Ticket Confirmation</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
                    h2 { color: #4CAF50; }
                    h3 { color: #333; }
                    footer { border-top: 1px solid #ddd; padding-top: 10px; color: #666; margin-top: 20px; }
                    a { color: #4CAF50; text-decoration: none; }
                </style>
            </head>
            <body>
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                    <h2>Help Ticket Created: REF#${referenceNumber}</h2>
                    <p>
                        Thank you for contacting <strong>TurboChat</strong> support. We have received your ticket successfully. 
                        Please allow 2-4 business days for our team to respond.
                    </p>
                    
                    <h3>Your Message:</h3>
                    <p>${message}</p>
                    
                    <footer>
                        <p>TurboChat © 2024</p>
                        <p>
                            <a href="http://localhost:1010">Home</a> | 
                            <a href="http://localhost:1010/terms-of-use">Terms of Use</a> | 
                            <a href="http://localhost:1010/privacy-policy">Privacy Policy</a> | 
                            <a href="#">Unsubscribe</a>
                        </p>
                    </footer>
                </div>
            </body>
        </html>
    `;

    // Configure mail options with HTML content
    const mailOptions = {
        from: 'bestorangelover@gmail.com',
        to: email,
        subject: `Support Request from ${name} - REF#${referenceNumber}`,
        html: emailHtml // Using HTML content here
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Failed to send email');
        } else {
            console.log('Email sent: ' + info.response);
            return res.status(200).send('Email sent successfully');
        }
    });
});




function deleteUser(username, callback) {
  db.run(`DELETE FROM users WHERE username = ?`, [username], function (err) {
    if (err) {
      console.error('Error deleting user from database:', err);
      callback(err);
    } else {
      console.log(`User ${username} deleted from database.`);
      callback(null);
    }
  });
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);
});
function getAllUsers(callback) {
  db.all(`SELECT username FROM users`, (err, rows) => {
    if (err) {
      console.error('Error fetching users from the database:', err);
      callback(err, null);
    } else {
      const userList = rows.map(row => row.username);
      callback(null, userList);
    }
  });
}

app.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    // Optionally, save the image path or URL in the database
    const imageUrl = `/uploads/${req.file.filename}`;
    return res.status(200).json({ imageUrl });
});

// Serve the uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.post('/dev-tools-detected.html', (req, res) => {
    try {
        const username = req.body.username; // Receive the username from the client
        if (!username) {
            return res.status(400).json({ success: false, message: 'Username not provided' });
        }

        // Log the event
        console.log(`${username} has opened DevTools.`);

        // Define the message with the warning
        const message = `${username} has opened DevTools.`;

        // Send a message to admins (huyckkid14 and adminuser)
        if (users['huyckkid14']) {
            users['huyckkid14'].send(JSON.stringify({
                type: 'chat',
                from: 'system',
                to: 'huyckkid14',
                message: message // Include the warning in the message
            }));
        }
        if (users['adminuser']) {
            users['adminuser'].send(JSON.stringify({
                type: 'chat',
                from: 'system',
                to: 'adminuser',
                message: message // Include the warning in the message
            }));
        }

        // Respond with success
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error handling DevTools detection:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Function to handle poll-related messages
// Function to handle poll-related messages
// Function to handle poll-related messages
function handlePollMessage(ws, msg) {
  switch (msg.action) {
    case 'create':
      // Set the activePoll variable when a new poll is created
      activePoll = {
        question: msg.question,
        options: msg.options.map((option) => ({ text: option, votes: 0 })), // Initialize votes for each option
        voters: new Set(), // To track who has voted
        creator: msg.creator // Store the poll creator
      };

      // Broadcast "Created by" message to all clients before showing the poll
      broadcastPoll({
        type: 'poll',
        action: 'createdBy',
        creator: msg.creator // This should now correctly send the creator
      });

      // Broadcast the poll itself
      broadcastPoll({
        type: 'poll',
        action: 'create',
        question: msg.question,
        options: msg.options
      });
      break;

    case 'vote':
      if (activePoll && !activePoll.voters.has(msg.voter)) {
        activePoll.options[msg.optionIndex].votes += 1; // Increment the vote count
        activePoll.voters.add(msg.voter); // Add voter to the set to prevent duplicate voting

        broadcastPoll({
          type: 'poll',
          action: 'vote',
          optionIndex: msg.optionIndex,
          voter: msg.voter
        });
      }
      break;

    case 'end':
      if (activePoll) {
        // Broadcast poll end message
        broadcastPoll({
          type: 'poll',
          action: 'end',
          results: activePoll.options.map(option => `${option.text}: ${option.votes} votes`)
        });

        activePoll = null; // Clear the active poll after sharing results
      }
      break;

    default:
      console.log('Unknown poll action:', msg.action);
  }
}

// Function to broadcast poll data to all clients
function broadcastPoll(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Function to broadcast poll data to all clients
function broadcastPoll(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}


// Function to broadcast the poll data to all clients
function broadcastPoll(data) {
  // If the poll has already ended and we are trying to broadcast end results, do nothing
  if (data.type === 'poll' && data.action === 'end' && activePoll === null) {
    console.log('Poll has already ended. No further broadcasting.');
    return;
  }

  // Handle ending the poll
  if (data.action === 'end') {
    activePoll = null; // Clear the active poll state after ending
  }

  // Broadcast the data to all clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Configure session middleware
app.use(session({
  genid: () => uuidv4(),
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Simple in-memory storage for users and sessions
let users = {};
let messages = {};
const adminUsers = new Set(['huyckkid14', 'adminuser']);

let credentials = {};

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the "public" directory
app.use(express.static('public'));

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function (err) {
    if (err) {
      return res.status(400).json({ message: 'User already exists' });
    }
    return res.status(201).json({ message: 'User created successfully' });
  });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT password FROM users WHERE username = ?`, [username], async (err, row) => {
    if (err || !row || !(await bcrypt.compare(password, row.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    req.session.username = username;
    return res.status(200).json({ message: 'Login successful' });
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // Replace 'connect.sid' with your session cookie name if different
    return res.status(200).json({ message: 'Logout successful' });
  });
});

app.get('/session', (req, res) => {
  if (req.session.username) {
    return res.status(200).json({ 
      username: req.session.username,
      isAdmin: adminUsers.has(req.session.username),
      systemDisabled: systemDisabled
    });
  }
  return res.status(401).json({ message: 'Not authenticated' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const badWords = ["shit", "fuck", "ass", "stupid", "hell"];
const replacement = "CHAT";
const banThreshold = 2; // Threshold for banning users
const banDuration = 3000; // Ban duration in milliseconds (3 seconds)

const userWordCount = {}; // To track the count of inappropriate words per user
const bannedUsers = {}; // To track banned users and their unban time

function sanitizeMessage(message) {
  let sanitizedMessage = message;
  badWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitizedMessage = sanitizedMessage.replace(regex, replacement);
  });
  return sanitizedMessage;
}

function incrementWordCount(username) {
  if (!userWordCount[username]) {
    userWordCount[username] = 0;
  }
  userWordCount[username]++;
  if (userWordCount[username] > banThreshold) {
    bannedUsers[username] = Date.now() + banDuration;
    userWordCount[username] = 0; // Reset count after ban
    return true; // Return true if the user is now banned
  }
  return false;
}

function isUserBanned(username) {
  if (!bannedUsers[username]) {
    return false;
  }
  if (Date.now() > bannedUsers[username]) {
    delete bannedUsers[username];
    return false;
  }
  return true;
}


let activeGuessWord = null; // Store the active word to guess
let wordCreator = null; // Store the creator of the word

function handleGuessWordMessage(ws, msg) {
  switch (msg.action) {
    case 'create':
      if (activeGuessWord) {
        // Inform the user they can only create one word at a time
        ws.send(JSON.stringify({ type: 'system', message: "A word has already been created. Please wait until it's guessed." }));
      } else {
        activeGuessWord = msg.word;
        wordCreator = msg.creator;
        // Notify all users about the new word guessing game
        broadcastToEveryone(`A new word guessing game has started! Type /guess "your guess" to participate.`);
      }
      break;

    case 'guess':
      if (!activeGuessWord) {
        ws.send(JSON.stringify({ type: 'system', message: "No active word to guess right now." }));
      } else if (msg.word.toLowerCase() === activeGuessWord.toLowerCase()) {
        // Correct guess, notify everyone
        broadcastToEveryone(`${msg.user} guessed the word correctly! The word was: "${activeGuessWord}".`);
        // Clear the active word and creator
        activeGuessWord = null;
        wordCreator = null;
      } else {
        // Incorrect guess, notify the user
        ws.send(JSON.stringify({ type: 'system', message: `Your guess "${msg.word}" is incorrect. Try again!` }));
      }
      break;

    default:
      console.log("Unknown action in guessWord:", msg.action);
  }
}


// WebSocket handling
wss.on('connection', (ws, req) => {
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(`WebSocket connection from IP: ${clientIp}`);

  ws.on('message', (message) => {
    console.log('Received message:', message);

    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      console.error('Error parsing message:', e);
      return;
    }
    if (msg.type === 'guessWord') {
      handleGuessWordMessage(ws, msg);
    }

    switch (msg.type) {
        case 'story':
            // Broadcast the story message to all users
            broadcastToEveryone(msg.message, msg.from);
            break;
      case 'poll':
        handlePollMessage(ws, msg); // Handle poll actions
        break;
      case 'statusChange':
        const { username, isInactive } = msg;

        // Broadcast the status change to all users
        Object.values(users).forEach(user => {
          user.send(JSON.stringify({
            type: 'statusChange',
            username: username,
            isInactive: isInactive
          }));
        });
        break;
      case 'notifyAdmins':
        if (adminUsers.has(ws.name)) {
          const notificationMessage = msg.message;
          broadcastToAdmins(notificationMessage, ws.name);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'You do not have permission to use this command.' }));
        }
        break;
      case 'broadcast':
        if (adminUsers.has(ws.name)) {
          const broadcastMessage = msg.message;
          broadcastToEveryone(broadcastMessage, ws.name);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'You do not have permission to use this command.' }));
        }
        break;
      case 'dice':
        const endNumber = msg.endNumber;
        const sender = msg.from;

        if (typeof endNumber === 'number' && endNumber > 1) {
          const result = Math.floor(Math.random() * endNumber) + 1; // Generate random number between 1 and endNumber
          const broadcastMessage = `${sender} rolled a die with numbers 1 to ${endNumber} and got a ${result}!`;

          broadcastDiceResult(broadcastMessage);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid end number for dice roll.' }));
        }
        break;
      case 'login':
        console.log('User logged in:', msg.name);
        users[msg.name] = ws;
        ws.name = msg.name;

        broadcastUsers();

        if (messages[msg.name]) {
          messages[msg.name].forEach((message) => {
            ws.send(JSON.stringify(message));
          });
          delete messages[msg.name];
        }
        break;
case 'system':
  if (msg.command === 'incognito' && adminUsers.has(ws.name)) {
    ws.isIncognito = true; // Set a flag for incognito mode
    console.log(`Admin ${ws.name} is now in incognito mode.`);
    broadcastUsers(); // Update the users list without the incognito admin
  } else if (msg.command === 'incognito' && !adminUsers.has(ws.name)) {
    ws.send(JSON.stringify({ type: 'error', message: 'You do not have permission to use this command.' }));
  }
  break;


      case 'chat':

        if (isUserBanned(ws.name)) {
          ws.send(JSON.stringify({ type: 'error', message: 'You are temporarily banned from chatting.' }));
          return;
        }

        if (msg.to === 'system') {
          if (msg.message === '/users' && adminUsers.has(ws.name)) {
            // Handle the /users command
            getAllUsers((err, userList) => {
              if (err) {
                ws.send(JSON.stringify({ type: 'chat', from: 'system', message: 'Error fetching users' }));
              } else {
                const userMessage = `Registered users: ${userList.join(', ')}`;
                ws.send(JSON.stringify({ type: 'chat', from: 'system', message: userMessage }));
              }
            });
          } else if (msg.message === '/enable' && adminUsers.has(ws.name)) {
            systemDisabled = false;
            broadcastSystemEnabled();
            ws.send(JSON.stringify({ type: 'chat', from: 'system', message: 'System has been enabled for non-admin users.' }));
          } else if (msg.message === '/enable' && !adminUsers.has(ws.name)) {
            ws.send(JSON.stringify({ type: 'chat', from: 'system', message: 'You do not have permission to use this command.' }));
          } 
          
const parts = msg.message.match(/^\/ban p user (\S+)(?: "([^"]*)")?(?: "(\d+)")?$/);


if (msg.message === '/disable' && adminUsers.has(ws.name)) {
  systemDisabled = true;
  broadcastSystemDisabled();
  ws.send(JSON.stringify({ type: 'chat', from: 'system', message: 'System has been disabled for non-admin users.' }));
} else if (msg.message === '/disable' && !adminUsers.has(ws.name)) {
  ws.send(JSON.stringify({ type: 'chat', from: 'system', message: 'You do not have permission to use this command.' }));
} else if (parts && adminUsers.has(ws.name)) {
    const usernameToBan = parts[1];
    const adminMessage = parts[2] || 'You have been banned.';
    const countdownDuration = parseInt(parts[3], 10) || 5; // Default to 5 seconds if not provided

    if (!usernameToBan) {
        ws.send(JSON.stringify({ type: 'chat', from: 'system', message: 'Ban Error: Please include a username.' }));
    } else if (isNaN(countdownDuration) || countdownDuration <= 0) {
        ws.send(JSON.stringify({ type: 'chat', from: 'system', message: 'Ban Error: Please provide a valid countdown time in seconds.' }));
    } else if (users[usernameToBan]) {
        // Send permanent ban message with countdown to user
        users[usernameToBan].send(JSON.stringify({
            type: 'permanentBan',
            adminName: ws.name,
            adminMessage: adminMessage,
            countdown: countdownDuration
        }));
        users[usernameToBan].close();
        delete users[usernameToBan];
        broadcastUsers();
        
        // Delete user from database
        deleteUser(usernameToBan, (err) => {
            if (err) {
                ws.send(JSON.stringify({ type: 'error', message: `Error deleting user ${usernameToBan}. `}));
            } else {
                ws.send(JSON.stringify({ type: 'chat', from: 'system', message: `${usernameToBan} permanently banned and data deleted.` }));
            }
        });
    } else {
        ws.send(JSON.stringify({ type: 'chat', from: 'system', message: `Ban Error: ${usernameToBan} is not found in the server.` }));
    }
} else if (msg.message.startsWith('/ban user ') && adminUsers.has(ws.name)) {
            const usernameToBan = msg.message.split(' ')[2];
            if (users[usernameToBan]) {
              // Ban the user
              users[usernameToBan].send(JSON.stringify({
                type: 'banned',
                adminName: ws.name
              }));
              users[usernameToBan].close();
              delete users[usernameToBan];
              broadcastUsers();
              
              // Send success message
              const successMessage = { type: 'chat', from: 'system', message: `${usernameToBan} banned `};
              ws.send(JSON.stringify(successMessage));
            } else {
              // Send error message
              const errorMessage = { type: 'chat', from: 'system', message: `Ban Error: ${usernameToBan} is not found in the server.` };
              ws.send(JSON.stringify(errorMessage));
            }
          } else {
            // Handle other system messages like "/time-date"
            if (msg.message === "/time-date") {
              const now = new Date();
              const dateTimeString = `Date: ${now.toLocaleDateString()}, Time: ${now.toLocaleTimeString()}`;
              ws.send(JSON.stringify({ type: 'chat', from: 'system', message: dateTimeString }));
            } else {
              // Send command error message
              const errorMsg = `Command Error: ${msg.message} is not a defined command. Type "/commands" for list of commands`;
              ws.send(JSON.stringify({ type: 'chat', from: 'system', message: errorMsg }));
            }
          }
        } else {
          // Regular chat message handling
          console.log('Chat message from:', ws.name, 'to:', msg.to);
          
          let containsBadWord = badWords.some(word => new RegExp(`\\b${word}\\b`, 'gi').test(msg.message));
          
          if (containsBadWord) {
            if (incrementWordCount(ws.name)) {
              console.log(`User ${ws.name} banned for using inappropriate language.`);
              ws.send(JSON.stringify({ type: 'error', message: 'You have been temporarily banned for using inappropriate language.' }));
              return;
            }
          }
          
          const sanitizedMessage = sanitizeMessage(msg.message);
          const isAdmin = adminUsers.has(ws.name);
          const messageToSend = { 
            type: 'chat',
            from: ws.name, 
            to: msg.to,
            message: sanitizedMessage,
            isAdmin: isAdmin
          };
          const mentionedUsers = msg.message.match(/@\w+/g) || [];

  // Send the message to the intended recipient
  if (users[msg.to]) {
    users[msg.to].send(JSON.stringify(messageToSend));
  } else {
    console.log('User not online:', msg.to);
    if (!messages[msg.to]) {
      messages[msg.to] = [];
    }
    messages[msg.to].push(messageToSend);
  }

  // Forward the message to mentioned users
  mentionedUsers.forEach((mention) => {
    const mentionedUsername = mention.slice(1); // Remove the '@' character
    if (users[mentionedUsername] && mentionedUsername !== msg.to) {
      users[mentionedUsername].send(JSON.stringify({
        ...messageToSend,
        type: 'mention',
        originalTo: msg.to
      }));
    }
  });


          // Send the message to all admins
          adminUsers.forEach(admin => {
            if (users[admin]) {
              users[admin].send(JSON.stringify({
                type: 'chat',
                from: ws.name,
                to: msg.to,
                message: sanitizedMessage,
                isAdmin: isAdmin
              }));
            }
          });
        }
        break;

      case 'ban':
        if (adminUsers.has(ws.name)) {
          const userToBan = msg.user;
          if (users[userToBan]) {
            users[userToBan].send(JSON.stringify({ 
              type: 'banned', 
              adminName: ws.name 
            }));
            users[userToBan].close();
            delete users[userToBan];
            broadcastUsers();
          }
        }
        break;

      case 'typing':
        console.log('Typing indicator from:', msg.from, 'to:', msg.to);
        if (users[msg.to]) {
          users[msg.to].send(JSON.stringify({ type: 'typing', from: msg.from, to: msg.to }));
        }
        break;

      case 'stopTyping':
        console.log('Stop typing indicator from:', msg.from, 'to:', msg.to);
        if (users[msg.to]) {
          users[msg.to].send(JSON.stringify({ type: 'stopTyping', from: msg.from, to: msg.to }));
        }
        break;

      default:
        console.log('Unknown message type:', msg.type);
    }
  });

  ws.on('close', () => {
    console.log('User disconnected:', ws.name);
    delete users[ws.name];
    broadcastUsers();
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});
function broadcastDiceResult(message) {
  Object.values(users).forEach(user => {
    user.send(JSON.stringify({
      type: 'diceResult',
      message: message
    }));
  });
}

function broadcastToEveryone(message, sender) {
  Object.values(users).forEach(user => {
    user.send(JSON.stringify({
      type: 'chat',
      from: 'system',
      to: 'everyone',
      message: `Broadcast from ${sender}: ${message}`
    }));
  });
}

function broadcastToAdmins(message, sender) {
  adminUsers.forEach(admin => {
    if (users[admin]) {
      users[admin].send(JSON.stringify({
        type: 'chat',
        from: 'system',
        to: admin,
        message: `Notification from ${sender}: ${message}`
      }));
    }
  });
}


function broadcastUsers() {
  const onlineUsers = Object.keys(users).filter(username => !users[username].isIncognito); // Exclude incognito users
  const message = { type: 'updateUsers', users: onlineUsers };

  Object.values(users).forEach(user => {
    if (!user.isIncognito) { // Do not send user updates to incognito admins
      user.send(JSON.stringify(message));
    }
  });

  const isAdminOnline = onlineUsers.some(user => adminUsers.has(user));
  if (isAdminOnline) {
    message.type = 'adminStatus';
    message.status = 'Admin on duty';
  } else {
    message.type = 'adminStatus';
    message.status = 'No admin on duty';
  }

  Object.values(users).forEach(user => user.send(JSON.stringify(message)));
}


function broadcastSystemDisabled() {
  const message = { type: 'systemDisabled' };
  Object.entries(users).forEach(([username, user]) => {
    if (!adminUsers.has(username)) {
      user.send(JSON.stringify(message));
    }
  });
}

function broadcastSystemEnabled() {
  const message = { type: 'systemEnabled' };
  Object.entries(users).forEach(([username, user]) => {
    if (!adminUsers.has(username)) {
      user.send(JSON.stringify(message));
    }
  });
}

/*
// Serve the privacy policy content
app.get('/get-privacy-policy', (req, res) => {
  fs.readFile(path.join(__dirname, 'public', 'privacy-policy.html'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading privacy policy:', err);
      return res.status(500).send('Error loading privacy policy');
    }
    res.send(data);
  });
});

// Serve the last updated date (you might store this separately or within the content)
app.get('/get-last-updated', (req, res) => {
  // Here you could store and fetch the date from a database or another file
  // For simplicity, let's assume it's stored within the privacy-policy.html or in a separate file
  fs.readFile(path.join(__dirname, 'last-updated.txt'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading last updated date:', err);
      return res.status(500).send('Error loading last updated date');
    }
    res.send(data);
  });
});

// Save the updated privacy policy content
app.post('/save-privacy-policy', (req, res) => {
  if (req.session.username && adminUsers.has(req.session.username)) {
    const newContent = req.body.content; // Full HTML content

    if (!newContent || typeof newContent !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid data provided' });
    }

    // Save the full content to the privacy-policy.html file
    fs.writeFile(path.join(__dirname, 'public', 'privacy-policy.html'), newContent, 'utf8', (err) => {
      if (err) {
        console.error('Error saving privacy policy:', err);
        return res.status(500).json({ success: false, message: 'Failed to save changes' });
      }

      res.status(200).json({ success: true, message: 'Privacy policy updated successfully' });
    });
  } else {
    res.status(403).json({ success: false, message: 'Unauthorized' });
  }
});

*/
// 500 error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, 'public', '500.html'));
});
app.get('/video.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'video.html'));
});
app.get(['/privacy-policy', '/privacy-policy.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy-policy.html'));
});

app.get(['/terms-of-use', '/terms-of-use.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms-of-use.html'));
});



/*

app.post('/save-terms', (req, res) => {
  if (req.session.username && adminUsers.has(req.session.username)) {
    const newContent = req.body.content;

    // Save the content to the terms-of-use.html file
    fs.writeFile(path.join(__dirname, 'public', 'terms-of-use.html'), newContent, 'utf8', (err) => {
      if (err) {
        console.error('Error saving Terms of Use:', err);
        return res.status(500).json({ message: 'Failed to save changes' });
      }

      console.log('Terms of Use updated successfully');
      res.status(200).json({ message: 'Terms of Use updated successfully' });
    });
  } else {
    res.status(403).json({ message: 'Unauthorized' });
  }
});
*/
app.post('/remove-user', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username not provided' });
  }

  // Delete user from the database
  deleteUser(username, (err) => {
    if (err) {
      console.error('Error deleting user from database:', err);
      return res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
    console.log(`User ${username} deleted from database.`);

    // Destroy the session if it exists
    if (req.session.username === username) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        } else {
          console.log(`Session destroyed for user ${username}`);
        }
      });
    }

    // Send a logout message to the user to force logout
    if (users[username]) {
      users[username].send(JSON.stringify({ type: 'logout', message: 'You have been logged out due to account removal.' }));
      users[username].close(); // Close the WebSocket connection
      delete users[username];
    }

    // Broadcast the updated list of users to all clients
    broadcastUsers();

    res.status(200).json({ success: true });
  });
});


const uploadVoice = multer({ dest: 'voice_uploads/' }); // Save voice messages to 'voice_uploads' directory

app.post('/upload-voice', uploadVoice.single('voiceMessage'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    // Optionally, save the audio path or URL in the database
    const voiceUrl = `/voice_uploads/${req.file.filename}`;
    return res.status(200).json({ voiceUrl });
});

// Serve the uploaded voice messages
app.use('/voice_uploads', express.static(path.join(__dirname, 'voice_uploads')));



// Serve the 403.html file when requested
app.get('/403.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', '403.html'));
});

app.get('/dev-tools-detected.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dev-tools-detected.html'));
});


// 404 handler (must be the last middleware)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

server.listen(1010, '0.0.0.0', () => {
  console.log('Server is listening on port 1010');
}); 