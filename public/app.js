let currentUser = null;

async function checkAuth() {
    try {
        const res = await fetch('/api/current-user');
        const data = await res.json();
        currentUser = data.user;
    } catch {
        currentUser = null;
    }
    updateNavbar();
}

function updateNavbar() {
    const navLinks = document.getElementById('navLinks');
    if (currentUser) {
        navLinks.innerHTML = `
            <a href="/" class="nav-home">Home</a>
            <a href="/create" class="nav-create">Write Post</a>
            <span style="font-weight: 600; color: var(--primary);">Hi, ${currentUser.username}</span>
            <button onclick="logout()" class="btn btn-outline" style="padding: 0.3rem 0.8rem;">Logout</button>
        `;
    } else {
        navLinks.innerHTML = `
            <a href="/" class="nav-home">Home</a>
            <a href="/login">Login</a>
            <a href="/register" class="btn btn-primary" style="padding: 0.4rem 1rem;">Get Started</a>
        `;
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null;
    updateNavbar();
    navigateTo('/');
}

// Frontend Router
function navigateTo(path) {
    window.history.pushState({}, '', path);
    router();
}

window.addEventListener('popstate', router);

document.addEventListener('click', e => {
    if (e.target.tagName === 'A' && e.target.getAttribute('href') && e.target.getAttribute('href').startsWith('/')) {
        e.preventDefault();
        navigateTo(e.target.getAttribute('href'));
    }
});

async function router() {
    await checkAuth();
    const path = window.location.pathname;
    const app = document.getElementById('app');

    document.querySelectorAll('.nav-links a').forEach(a => {
        if (a.getAttribute('href') === path) a.classList.add('active');
        else a.classList.remove('active');
    });

    if (path === '/') {
        await renderHome(app);
    } else if (path === '/login') {
        renderLogin(app);
    } else if (path === '/register') {
        renderRegister(app);
    } else if (path === '/create') {
        if (!currentUser) { navigateTo('/login'); return; }
        renderCreatePost(app);
    } else if (path.startsWith('/posts/')) {
        const postId = path.split('/')[2];
        await renderPostDetail(app, postId);
    } else if (path.startsWith('/edit/')) {
        if (!currentUser) { navigateTo('/login'); return; }
        const postId = path.split('/')[2];
        await renderEditPost(app, postId);
    } else {
        app.innerHTML = '<div class="card" style="text-align: center;"><h2>404 - Page Not Found</h2><p>The page you are looking for does not exist.</p><br><a href="/" class="btn btn-primary">Go Home</a></div>';
    }
}

// Views
async function renderHome(container) {
    container.innerHTML = `
        <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h1 style="font-size: 2rem; font-weight: 800; margin-bottom: 0.25rem;">Explore Stories</h1>
                <p style="color: var(--text-muted);">Discover thoughts, ideas, and writing from our community.</p>
            </div>
            ${currentUser ? '<a href="/create" class="btn btn-primary">+ New Post</a>' : ''}
        </div>
        <div id="postsList"><p style="text-align: center; color: var(--text-muted);">Loading posts...</p></div>
    `;

    try {
        const res = await fetch('/api/posts');
        const posts = await res.json();
        const postsList = document.getElementById('postsList');

        if (posts.length === 0) {
            postsList.innerHTML = '<div class="card" style="text-align: center;"><p>No blog posts published yet. Be the first!</p></div>';
            return;
        }

        postsList.innerHTML = posts.map(post => `
            <div class="post-card">
                <a href="/posts/${post.id}" class="post-title">${escapeHTML(post.title)}</a>
                <div class="post-meta">By <strong>${escapeHTML(post.username)}</strong> on ${new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <p class="post-snippet">${escapeHTML(post.content.substring(0, 180))}...</p>
                <a href="/posts/${post.id}" class="btn btn-outline" style="font-size: 0.85rem; padding: 0.4rem 0.8rem;">Read Article →</a>
            </div>
        `).join('');
    } catch {
        document.getElementById('postsList').innerHTML = '<p class="alert alert-error">Failed to load posts.</p>';
    }
}

function renderLogin(container) {
    container.innerHTML = `
        <div class="card" style="max-width: 450px; margin: 0 auto;">
            <h2 style="margin-bottom: 1.5rem; text-align: center;">Welcome Back</h2>
            <div id="loginAlert"></div>
            <form id="loginForm">
                <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" id="loginEmail" class="form-control" required placeholder="you@example.com">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="loginPassword" class="form-control" required placeholder="••••••••">
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">Sign In</button>
            </form>
            <p style="text-align: center; margin-top: 1.25rem; font-size: 0.9rem; color: var(--text-muted);">
                Don't have an account? <a href="/register" style="color: var(--primary); text-decoration: none;">Register here</a>
            </p>
        </div>
    `;

    document.getElementById('loginForm').addEventListener('submit', async(e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const alertBox = document.getElementById('loginAlert');

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            currentUser = data.user;
            updateNavbar();
            navigateTo('/');
        } catch (err) {
            alertBox.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    });
}

function renderRegister(container) {
    container.innerHTML = `
        <div class="card" style="max-width: 450px; margin: 0 auto;">
            <h2 style="margin-bottom: 1.5rem; text-align: center;">Create Account</h2>
            <div id="registerAlert"></div>
            <form id="registerForm">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="regUsername" class="form-control" required placeholder="johndoe">
                </div>
                <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" id="regEmail" class="form-control" required placeholder="you@example.com">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="regPassword" class="form-control" required placeholder="••••••••">
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">Sign Up</button>
            </form>
            <p style="text-align: center; margin-top: 1.25rem; font-size: 0.9rem; color: var(--text-muted);">
                Already have an account? <a href="/login" style="color: var(--primary); text-decoration: none;">Log in</a>
            </p>
        </div>
    `;

    document.getElementById('registerForm').addEventListener('submit', async(e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const alertBox = document.getElementById('registerAlert');

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            alertBox.innerHTML = `<div class="alert alert-success">Registration successful! Redirecting to login...</div>`;
            setTimeout(() => navigateTo('/login'), 1500);
        } catch (err) {
            alertBox.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    });
}

function renderCreatePost(container) {
    container.innerHTML = `
        <div class="card">
            <h2 style="margin-bottom: 1.5rem;">Create New Blog Post</h2>
            <div id="postAlert"></div>
            <form id="createPostForm">
                <div class="form-group">
                    <label>Post Title</label>
                    <input type="text" id="postTitle" class="form-control" required placeholder="Enter an engaging title...">
                </div>
                <div class="form-group">
                    <label>Content</label>
                    <textarea id="postContent" class="form-control" required placeholder="Write your story here..."></textarea>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button type="submit" class="btn btn-primary">Publish Post</button>
                    <a href="/" class="btn btn-outline">Cancel</a>
                </div>
            </form>
        </div>
    `;

    document.getElementById('createPostForm').addEventListener('submit', async(e) => {
        e.preventDefault();
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;
        const alertBox = document.getElementById('postAlert');

        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            navigateTo(`/posts/${data.postId}`);
        } catch (err) {
            alertBox.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        }
    });
}

async function renderPostDetail(container, postId) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Loading post...</p>`;

    try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error('Post not found');
        const post = await res.json();

        const isAuthor = currentUser && currentUser.id === post.user_id;

        container.innerHTML = `
            <div class="card" style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <h1 style="font-size: 2rem; color: var(--text-main);">${escapeHTML(post.title)}</h1>
                    ${isAuthor ? `
                        <div style="display: flex; gap: 0.5rem;">
                            <a href="/edit/${post.id}" class="btn btn-outline" style="font-size: 0.85rem;">Edit</a>
                            <button onclick="deletePost(${post.id})" class="btn btn-danger" style="font-size: 0.85rem;">Delete</button>
                        </div>
                    ` : ''}
                </div>
                <div class="post-meta" style="margin-bottom: 1.5rem;">
                    Published by <strong>${escapeHTML(post.username)}</strong> on ${new Date(post.created_at).toLocaleString()}
                </div>
                <div style="white-space: pre-wrap; font-size: 1.05rem; line-height: 1.8; color: var(--text-main);">${escapeHTML(post.content)}</div>
            </div>

            <div class="card comments-section">
                <h3 style="margin-bottom: 1.25rem;">Discussion (${post.comments.length})</h3>
                
                ${currentUser ? `
                    <form id="commentForm" style="margin-bottom: 2rem;">
                        <div class="form-group">
                            <textarea id="commentText" class="form-control" required placeholder="What are your thoughts?" style="min-height: 80px;"></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary" style="font-size: 0.9rem;">Post Comment</button>
                    </form>
                ` : `
                    <p style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-muted);">
                        Please <a href="/login" style="color: var(--primary);">log in</a> to join the conversation.
                    </p>
                `}

                <div id="commentsList">
                    ${post.comments.length === 0 ? '<p style="color: var(--text-muted); font-size: 0.9rem;">No comments yet. Be the first to share your thoughts!</p>' : ''}
                    ${post.comments.map(c => `
                        <div class="comment-item">
                            <div class="comment-header">
                                <span class="comment-author">${escapeHTML(c.username)}</span>
                                <span>${new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            <p style="font-size: 0.95rem; white-space: pre-wrap;">${escapeHTML(c.comment)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        if (currentUser) {
            document.getElementById('commentForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const comment = document.getElementById('commentText').value;

                try {
                    const res = await fetch(`/api/posts/${postId}/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ comment })
                    });
                    if (!res.ok) throw new Error('Failed to post comment');
                    
                    renderPostDetail(container, postId);
                } catch (err) {
                    alert(err.message);
                }
            });
        }
    } catch {
        container.innerHTML = '<div class="card" style="text-align: center;"><h2>Post not found</h2><br><a href="/" class="btn btn-primary">Back to Home</a></div>';
    }
}

async function renderEditPost(container, postId) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Loading post...</p>`;

    try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error('Post not found');
        const post = await res.json();

        if (!currentUser || currentUser.id !== post.user_id) {
            navigateTo('/');
            return;
        }

        container.innerHTML = `
            <div class="card">
                <h2 style="margin-bottom: 1.5rem;">Edit Post</h2>
                <div id="editAlert"></div>
                <form id="editPostForm">
                    <div class="form-group">
                        <label>Post Title</label>
                        <input type="text" id="editTitle" class="form-control" required value="${escapeHTML(post.title)}">
                    </div>
                    <div class="form-group">
                        <label>Content</label>
                        <textarea id="editContent" class="form-control" required>${escapeHTML(post.content)}</textarea>
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                        <a href="/posts/${postId}" class="btn btn-outline">Cancel</a>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('editPostForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('editTitle').value;
            const content = document.getElementById('editContent').value;
            const alertBox = document.getElementById('editAlert');

            try {
                const res = await fetch(`/api/posts/${postId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                navigateTo(`/posts/${postId}`);
            } catch (err) {
                alertBox.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
            }
        });
    } catch {
        container.innerHTML = '<div class="card" style="text-align: center;"><h2>Error loading post</h2><br><a href="/" class="btn btn-primary">Go Home</a></div>';
    }
}

async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;

    try {
        const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete post');
        navigateTo('/');
    } catch (err) {
        alert(err.message);
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

router();