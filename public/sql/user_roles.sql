CREATE TABLE IF NOT EXISTS user_roles (
    userID VARCHAR(255) NOT NULL,
    roles JSON NOT NULL,
    PRIMARY KEY (userID)
);