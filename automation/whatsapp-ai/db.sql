-- MySQL schema for conversations and messages
CREATE TABLE conversations (
  id VARCHAR(36) PRIMARY KEY,
  lead_id VARCHAR(255),
  phone VARCHAR(32) NOT NULL,
  status VARCHAR(32) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(36),
  role ENUM('lead','ai','system') NOT NULL,
  content TEXT NOT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
