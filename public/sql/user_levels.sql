CREATE TABLE IF NOT EXISTS user_levels (
    userID VARCHAR(255) NOT NULL,
    level INTEGER NOT NULL,
    experience INTEGER NOT NULL,
    PRIMARY KEY (userID)
);