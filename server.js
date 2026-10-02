const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        return;
    }
    console.log('Connected to MySQL database successfully.');
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

// ================= RESTful API Routes =================

// Register User
app.post('/api/register', async(req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
        db.query(query, [username, email, hashedPassword], (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'Username or Email already exists.' });
                }
                return res.status(500).json({ error: 'Database error during registration.' });
            }
            res.status(201).json({ message: 'User registered successfully.' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// Login User
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async(err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (results.length === 0) return res.status(401).json({ error: 'Invalid email or password.' });

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid email or password.' });

        req.session.user = { id: user.id, username: user.username, email: user.email };
        res.json({ message: 'Login successful.', user: req.session.user });
    });
});

// Logout User
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Could not log out.' });
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully.' });
    });
});

// Get Current Logged-in User
app.get('/api/current-user', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ user: null });
    }
});

// Get All Posts
app.get('/api/posts', (req, res) => {
    const query = `
        SELECT posts.*, users.username 
        FROM posts 
        JOIN users ON posts.user_id = users.id 
        ORDER BY posts.created_at DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch posts.' });
        res.json(results);
    });
});

// Get Single Post + Comments
app.get('/api/posts/:id', (req, res) => {
    const postId = req.params.id;
    const postQuery = `
        SELECT posts.*, users.username 
        FROM posts 
        JOIN users ON posts.user_id = users.id 
        WHERE posts.id = ?
    `;
    const commentsQuery = `
        SELECT comments.*, users.username 
        FROM comments 
        JOIN users ON comments.user_id = users.id 
        WHERE comments.post_id = ? 
        ORDER BY comments.created_at ASC
    `;

    db.query(postQuery, [postId], (err, postResults) => {
        if (err || postResults.length === 0) return res.status(404).json({ error: 'Post not found.' });

        const post = postResults[0];
        db.query(commentsQuery, [postId], (err, commentResults) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch comments.' });
            post.comments = commentResults;
            res.json(post);
        });
    });
});

// Create Post
app.post('/api/posts', isAuthenticated, (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required.' });

    const query = 'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)';
    db.query(query, [req.session.user.id, title, content], (err, result) => {
        if (err) return res.status(500).json({ error: 'Failed to create post.' });
        res.status(201).json({ message: 'Post created successfully.', postId: result.insertId });
    });
});

// Update Post
app.put('/api/posts/:id', isAuthenticated, (req, res) => {
    const postId = req.params.id;
    const { title, content } = req.body;

    db.query('SELECT * FROM posts WHERE id = ?', [postId], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'Post not found.' });
        if (results[0].user_id !== req.session.user.id) {
            return res.status(403).json({ error: 'Forbidden. You can only edit your own posts.' });
        }

        const updateQuery = 'UPDATE posts SET title = ?, content = ? WHERE id = ?';
        db.query(updateQuery, [title, content, postId], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to update post.' });
            res.json({ message: 'Post updated successfully.' });
        });
    });
});

// Delete Post
app.delete('/api/posts/:id', isAuthenticated, (req, res) => {
    const postId = req.params.id;

    db.query('SELECT * FROM posts WHERE id = ?', [postId], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'Post not found.' });
        if (results[0].user_id !== req.session.user.id) {
            return res.status(403).json({ error: 'Forbidden. You can only delete your own posts.' });
        }

        db.query('DELETE FROM posts WHERE id = ?', [postId], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to delete post.' });
            res.json({ message: 'Post deleted successfully.' });
        });
    });
});

// Add Comment to Post
app.post('/api/posts/:id/comments', isAuthenticated, (req, res) => {
    const postId = req.params.id;
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ error: 'Comment text is required.' });

    const query = 'INSERT INTO comments (post_id, user_id, comment) VALUES (?, ?, ?)';
    db.query(query, [postId, req.session.user.id, comment], (err, result) => {
        if (err) return res.status(500).json({ error: 'Failed to add comment.' });
        res.status(201).json({ message: 'Comment added successfully.', commentId: result.insertId });
    });
});

// Fallback to frontend index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});