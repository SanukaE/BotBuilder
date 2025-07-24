CREATE TABLE IF NOT EXISTS tickets (
    category VARCHAR(255) NOT NULL,
    channelID VARCHAR(255) NOT NULL,
    ownerID VARCHAR(255) NOT NULL,
    claimedBy VARCHAR(255),
    formData JSON
);