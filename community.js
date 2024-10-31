document.addEventListener('DOMContentLoaded', () => {
    const postForm = document.getElementById('post-form');
    const postsContainer = document.getElementById('posts-container');
    const sortBySelect = document.getElementById('sort-by'); // Added sortBySelect variable

    // Function to create a new post
    postForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const postContent = document.getElementById('post-content').value;

        if (postContent.trim() === '') {
            alert('Please enter something before posting.');
            return;
        }

        // Send the post to the server
        fetch('/create-post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: postContent })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadPosts(sortBySelect.value); // Reload posts after creating a new one
                postForm.reset(); // Clear the form
            } else {
                alert('Error posting. Please try again.');
            }
        })
        .catch(error => console.error('Error:', error));
    });

    // Function to add a post to the page with reply and report functionality
    function addPostToPage(post) {
        const postElement = document.createElement('div');
        postElement.classList.add('post');
        postElement.setAttribute('data-id', post.id); // Set the post ID
        postElement.innerHTML = `
            <p>${post.content}</p>
            <small>Posted on ${new Date(post.timestamp).toLocaleString()}</small>
            <button class="reply-btn">Reply</button>
            <button class="report-btn">Report</button> <!-- Report button -->
            <button class="delete-btn">Delete</button> <!-- Delete button -->
            <div class="reply-section" style="display: none;">
                <textarea class="reply-content" placeholder="Write a reply..."></textarea>
                <button class="submit-reply">Submit Reply</button>
            </div>
            <div class="replies-container"></div> <!-- This will hold replies -->
        `;
        postsContainer.prepend(postElement); // Add new post to the top

        // Event listener for delete button
        const deleteBtn = postElement.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            const password = prompt('Enter Admin Password:');
            if (password === '123') {
                deletePost(post.id); // Call the function to delete the post
            } else {
                alert('Incorrect Password.');
            }
        });

        // Event listener for reply button
        const replyBtn = postElement.querySelector('.reply-btn');
        const replySection = postElement.querySelector('.reply-section');
        const replyContent = postElement.querySelector('.reply-content');
        const submitReplyBtn = postElement.querySelector('.submit-reply');
        const repliesContainer = postElement.querySelector('.replies-container');

        replyBtn.addEventListener('click', () => {
            replySection.style.display = replySection.style.display === 'none' ? 'block' : 'none';
        });

        submitReplyBtn.addEventListener('click', () => {
            const replyText = replyContent.value.trim();
            if (replyText === '') {
                alert('Please enter a reply.');
                return;
            }

            // Send the reply to the server
            fetch('/reply-post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ postId: post.id, reply: replyText })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    addReplyToPage(data.reply, repliesContainer);
                    replyContent.value = ''; // Clear reply content
                } else {
                    alert('Error submitting reply. Please try again.');
                }
            })
            .catch(error => console.error('Error:', error));
        });

        // Event listener for report button
        const reportBtn = postElement.querySelector('.report-btn');
        reportBtn.addEventListener('click', () => {
            const reason = prompt('Please provide a reason for reporting this post:');
            if (!reason) return; // If no reason is provided, do nothing

            // Send the report to the server
            fetch('/report-post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ postId: post.id, reason })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Report submitted successfully.');
                } else {
                    alert('Error reporting post. Please try again.');
                }
            })
            .catch(error => console.error('Error:', error));
        });
    }

    // Function to delete a post
    function deletePost(postId) {
        fetch(`/delete-post/${postId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Remove the post from the page
                const postElement = document.querySelector(`.post[data-id="${postId}"]`);
                if (postElement) {
                    postElement.remove();
                }
            } else {
                alert('Error deleting post. Please try again.');
            }
        })
        .catch(error => console.error('Error:', error));
    }

    // Function to add a reply to the page
    function addReplyToPage(reply, repliesContainer) {
        const replyElement = document.createElement('div');
        replyElement.classList.add('reply');
        replyElement.innerHTML = `
            <p>${reply.content}</p>
            <small>Replied on ${new Date(reply.timestamp).toLocaleString()}</small>
        `;
        repliesContainer.appendChild(replyElement); // Add new reply to the bottom
    }

    // Function to load and display posts based on sort order
    function loadPosts(sortOrder = 'newest') {
        fetch('/get-posts')
            .then(response => response.json())
            .then(posts => {
                // Clear the current posts container
                postsContainer.innerHTML = '';

                // Sort the posts based on the sort order
                if (sortOrder === 'newest') {
                    posts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                } else {
                    posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                }

                // Display sorted posts
                posts.forEach(post => {
                    addPostToPage(post);
                    const repliesContainer = document.querySelector(`.post[data-id='${post.id}'] .replies-container`);
                    post.replies.forEach(reply => addReplyToPage(reply, repliesContainer));
                });
            })
            .catch(error => console.error('Error fetching posts:', error));
    }

    // Fetch and display existing posts when the page loads
    loadPosts();

    // Handle sorting change
    sortBySelect.addEventListener('change', () => {
        const sortOrder = sortBySelect.value;
        loadPosts(sortOrder); // Load posts based on the selected sort order
    });
    const viewReportedPostsBtn = document.getElementById('view-reported-posts-btn');
    const reportedPostsModal = document.getElementById('reported-posts-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const reportedPostsContainer = document.getElementById('reported-posts-container');

    // Open the modal to view reported posts
    viewReportedPostsBtn.addEventListener('click', () => {
        const adminPassword = prompt('Enter Admin Password:');
        if (adminPassword === '123') {
            // Fetch reported posts from the server
            fetch('/get-reported-posts')
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.reportedPosts.length > 0) {
                        reportedPostsContainer.innerHTML = ''; // Clear previous posts
                        data.reportedPosts.forEach(post => {
                            const postElement = document.createElement('div');
                            postElement.classList.add('post');
                            postElement.innerHTML = `
                                <h3>${post.title}</h3>
                                <p>${post.content}</p>
                                <small>Reported Reason: ${post.reason}</small>
                            `;
                            reportedPostsContainer.appendChild(postElement);
                        });
                    } else {
                        reportedPostsContainer.innerHTML = '<p>No reported posts found.</p>';
                    }

                    // Display the modal
                    reportedPostsModal.style.display = 'block';
                })
                .catch(error => {
                    console.error('Error fetching reported posts:', error);
                });
        } else {
            alert('Incorrect Admin Password.');
        }
    });

    // Close the modal
    closeModalBtn.addEventListener('click', () => {
        reportedPostsModal.style.display = 'none';
    });

    // Close modal when clicking outside of the content
    window.addEventListener('click', (event) => {
        if (event.target === reportedPostsModal) {
            reportedPostsModal.style.display = 'none';
        }
    });});
