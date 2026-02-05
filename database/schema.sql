
-- Student Group Chat Application Database Schema

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS call_participants CASCADE;
DROP TABLE IF EXISTS group_calls CASCADE;
DROP TABLE IF EXISTS shared_files CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS group_invites CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- Students Table
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    college_name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Groups Table
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    description TEXT,
    group_type VARCHAR(20) NOT NULL CHECK (group_type IN ('public', 'private')),
    allowed_college VARCHAR(200), -- NULL for public, specific college for private
    created_by INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group Members Table
CREATE TABLE group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, student_id)
);

-- Group Invites Table
CREATE TABLE group_invites (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    invite_code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages Table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shared Files Table
CREATE TABLE shared_files (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    uploader_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group Calls Table
CREATE TABLE group_calls (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    call_type VARCHAR(20) NOT NULL CHECK (call_type IN ('audio', 'video')),
    started_by INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Call Participants Table
CREATE TABLE call_participants (
    id SERIAL PRIMARY KEY,
    call_id INTEGER NOT NULL REFERENCES group_calls(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    UNIQUE(call_id, student_id)
);

-- Create indexes for better performance
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_student ON group_members(student_id);
CREATE INDEX idx_messages_group ON messages(group_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_shared_files_group ON shared_files(group_id);
CREATE INDEX idx_group_calls_group ON group_calls(group_id);
CREATE INDEX idx_groups_type ON groups(group_type);
CREATE INDEX idx_groups_college ON groups(allowed_college);

-- Insert sample data for testing
-- Sample students from different colleges
INSERT INTO students (name, email, password, college_name) VALUES
('Ravi Kumar', 'ravi@gmail.com', '$2a$10$XqZ7K1WXVxQJ3YJ4Y7YHb.ZkGQqTZVGT7X1k8HZj5KYZ5X5X5X5X5', 'JNTU Hyderabad'),
('Priya Sharma', 'priya@gmail.com', '$2a$10$XqZ7K1WXVxQJ3YJ4Y7YHb.ZkGQqTZVGT7X1k8HZj5KYZ5X5X5X5X5', 'JNTU Hyderabad'),
('Arjun Reddy', 'arjun@gmail.com', '$2a$10$XqZ7K1WXVxQJ3YJ4Y7YHb.ZkGQqTZVGT7X1k8HZj5KYZ5X5X5X5X5', 'Osmania University'),
('Sneha Patel', 'sneha@gmail.com', '$2a$10$XqZ7K1WXVxQJ3YJ4Y7YHb.ZkGQqTZVGT7X1k8HZj5KYZ5X5X5X5X5', 'CBIT');

-- Sample public group
INSERT INTO groups (group_name, description, group_type, allowed_college, created_by) VALUES
('Placements Updates', 'Latest placement news and discussions', 'public', NULL, 1);

-- Sample private group
INSERT INTO groups (group_name, description, group_type, allowed_college, created_by) VALUES
('JNTU Study Group', 'Private study group for JNTU students', 'private', 'JNTU Hyderabad', 1);

-- Add members to groups
INSERT INTO group_members (group_id, student_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4),
(2, 1), (2, 2);

-- Create invite codes
INSERT INTO group_invites (group_id, invite_code) VALUES
(1, 'PUBLIC-PLACEMENT-2024'),
(2, 'PRIVATE-JNTU-STUDY');