function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

// Transcript loading functionality
function getChannelIdFromUrl() {
  // Extract :channelID from the URL path, e.g. /tickets/transcript/:channelID
  const match = window.location.pathname.match(
    /\/tickets\/transcript\/(\d{17,19})/
  );
  return match ? match[1] : null;
}

function parseTranscriptData(rawData) {
  if (!rawData || typeof rawData !== "string") {
    throw new Error("Invalid transcript data format");
  }

  const lines = rawData
    .trim()
    .split("\n")
    .filter((line) => line.trim());

  if (lines.length === 0) {
    throw new Error("Empty transcript data");
  }

  const data = {
    generalInfo: {},
    formInfo: {},
    summary: "",
    messages: [],
  };

  let currentSection = "";
  let messageBuffer = [];
  let summaryLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === "General Information") {
      currentSection = "general";
      continue;
    } else if (line === "Form Filled") {
      currentSection = "form";
      continue;
    } else if (line === "Ticket Summary") {
      currentSection = "summary";
      continue;
    } else if (line === "Ticket Conversation") {
      currentSection = "conversation";
      if (summaryLines.length > 0) {
        data.summary = summaryLines.join(" ").trim();
        summaryLines = [];
      }
      continue;
    }

    if (currentSection === "general" && line.includes(":")) {
      const colonIndex = line.indexOf(":");
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      if (key && value) {
        data.generalInfo[key] = value;
      }
    } else if (currentSection === "form" && line.includes(":")) {
      const colonIndex = line.indexOf(":");
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      if (key && value) {
        data.formInfo[key] = value;
      }
    } else if (currentSection === "summary" && line) {
      summaryLines.push(line);
    } else if (currentSection === "conversation") {
      if (line.match(/^\[.+ at .+\]:$/)) {
        if (messageBuffer.length > 0) {
          const message = parseMessage(messageBuffer);
          if (message) {
            data.messages.push(message);
          }
          messageBuffer = [];
        }
        messageBuffer.push(line);
      } else if (line.startsWith("Message:") || line.startsWith("Embeds:")) {
        messageBuffer.push(line);
      } else if (messageBuffer.length > 0 && line) {
        messageBuffer[messageBuffer.length - 1] += " " + line;
      }
    }
  }

  if (messageBuffer.length > 0) {
    const message = parseMessage(messageBuffer);
    if (message) {
      data.messages.push(message);
    }
  }

  if (summaryLines.length > 0 && !data.summary) {
    data.summary = summaryLines.join(" ").trim();
  }

  return data;
}

function parseMessage(messageLines) {
  if (!messageLines || messageLines.length === 0) {
    return null;
  }

  const headerLine = messageLines[0];
  const match = headerLine.match(/^\[(.+?) at (.+?)\]:$/);

  if (!match) {
    console.warn("Could not parse message header:", headerLine);
    return null;
  }

  const [, author, timestamp] = match;
  const message = {
    author: author.trim(),
    timestamp: timestamp.trim(),
    content: "",
    embeds: [],
    type: author === "BotBuilder" ? "bot" : "user",
  };

  for (let i = 1; i < messageLines.length; i++) {
    const line = messageLines[i].trim();
    if (line.startsWith("Message:")) {
      message.content = line.substring(8).trim();
    } else if (line.startsWith("Embeds:")) {
      const embedContent = line.substring(7).trim();
      if (embedContent) {
        message.embeds.push(embedContent);
      }
    }
  }

  return message;
}

function displayTranscriptData(data) {
  if (!data) {
    showError("No transcript data to display");
    return;
  }

  try {
    const openedBy = data.generalInfo["Opened By"] || "Unknown User";
    const ticketCategory = data.generalInfo["Ticket Category"] || "Unknown";

    document.title = `BotBuilder Dashboard | ${openedBy}'s ${ticketCategory} Ticket`;
    document.querySelector(
      ".transcript-description"
    ).textContent = `Viewing ${openedBy}'s ticket.`;

    const generalInfoMap = {
      ticketCategory: "Ticket Category",
      ticketOpenAt: "Ticket Open at",
      ticketSaveAt: "Transcript Save at",
      ticketOpenedBy: "Opened By",
      ticketClosedBy: "Closed By",
    };

    Object.entries(generalInfoMap).forEach(([elementId, key]) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.textContent = data.generalInfo[key] || "-";
      }
    });

    const closeReason = data.generalInfo["Close Reason"] || "Open";
    const statusElement = document.getElementById("ticketStatus");
    if (statusElement) {
      statusElement.textContent = closeReason;
      statusElement.className =
        "status-badge " +
        (closeReason.toLowerCase().includes("resolved")
          ? "status-resolved"
          : "status-open");
    }

    const issueElement = document.getElementById("ticketIssue");
    if (issueElement) {
      issueElement.textContent =
        data.formInfo["Issue"] || "No issue description provided.";
    }

    const summaryElement = document.getElementById("ticketSummary");
    if (summaryElement) {
      summaryElement.textContent = data.summary || "No summary available.";
    }

    renderMessages(data.messages || []);
  } catch (error) {
    console.error("Error displaying transcript data:", error);
    showError("Error displaying transcript data");
  }
}

function renderMessages(messages) {
  const messagesContainer = document.getElementById("conversationMessages");
  if (!messagesContainer) return;

  messagesContainer.innerHTML = "";

  if (messages.length === 0) {
    messagesContainer.innerHTML =
      '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No messages in this conversation.</p>';
    return;
  }

  messages.forEach((message, index) => {
    if (!message) return;

    const messageDiv = document.createElement("div");
    const isBot = message.type === "bot" || message.author === "BotBuilder";
    messageDiv.className = `message ${isBot ? "message-bot" : "message-user"}`;
    messageDiv.dataset.messageIndex = index;

    const headerDiv = document.createElement("div");
    headerDiv.className = "message-header";

    const authorSpan = document.createElement("span");
    authorSpan.className = `message-author ${isBot ? "bot" : "user"}`;
    authorSpan.textContent = message.author;

    const badgeSpan = document.createElement("span");
    badgeSpan.className = `message-badge ${isBot ? "badge-bot" : "badge-user"}`;
    badgeSpan.textContent = isBot ? "BOT" : "USER";

    const timestampSpan = document.createElement("span");
    timestampSpan.className = "message-timestamp";
    timestampSpan.textContent = message.timestamp;

    headerDiv.appendChild(authorSpan);
    headerDiv.appendChild(badgeSpan);
    headerDiv.appendChild(timestampSpan);

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.textContent = message.content || "(No message content)";

    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);

    if (message.embeds && message.embeds.length > 0) {
      message.embeds.forEach((embed) => {
        const embedDiv = document.createElement("div");
        embedDiv.className = "message-embed";
        embedDiv.style.cssText = `
          margin-top: 0.5rem; 
          padding: 0.75rem; 
          background: rgba(124, 58, 237, 0.1); 
          border-left: 3px solid var(--primary-color); 
          border-radius: 4px; 
          font-style: italic; 
          color: var(--text-secondary);
          font-size: 0.9rem;
        `;
        embedDiv.innerHTML = `<i class="fas fa-paperclip"></i> <strong>Embed:</strong> ${embed}`;
        messageDiv.appendChild(embedDiv);
      });
    }

    messagesContainer.appendChild(messageDiv);
  });

  const messageCountDiv = document.createElement("div");
  messageCountDiv.style.cssText = `
    text-align: center; 
    padding: 1rem; 
    color: var(--text-muted); 
    font-size: 0.9rem; 
    border-top: 1px solid var(--border-color); 
    margin-top: 1rem;
  `;
  messageCountDiv.innerHTML = `<i class="fas fa-comments"></i> Total Messages: ${messages.length}`;
  messagesContainer.appendChild(messageCountDiv);
}

async function loadTranscript() {
  const channelId = getChannelIdFromUrl();

  if (!channelId) {
    showError(
      "No ticket ID provided in URL. Please add ?id=CHANNEL_ID to the URL."
    );
    return;
  }

  if (!isValidChannelId(channelId)) {
    showError(
      "Invalid channel ID format. Please provide a valid Discord channel ID."
    );
    return;
  }

  try {
    const response = await fetch(`/api/transcript/${channelId}`, {
      headers: {
        Authorization: getCookie("apiKey") || "",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          "Transcript not found. The ticket may not exist or has been deleted."
        );
      } else if (response.status === 403) {
        throw new Error(
          "Access denied. You do not have permission to view this transcript."
        );
      } else {
        throw new Error(
          `Server error (${response.status}): ${response.statusText}`
        );
      }
    }

    const rawData = await response.text();

    if (!rawData || rawData.trim().length === 0) {
      throw new Error("Empty transcript data received.");
    }

    const transcriptData = parseTranscriptData(rawData);
    displayTranscriptData(transcriptData);

    document.getElementById("loadingState").style.display = "none";
    document.getElementById("transcriptContent").style.display = "block";
  } catch (error) {
    console.error("Failed to load transcript:", error);
    showError(`Failed to load transcript: ${error.message}`);
  }
}

function showError(message) {
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("errorState").style.display = "block";
  document.getElementById(
    "errorState"
  ).innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>${message}</p>`;
}

function isValidChannelId(id) {
  return /^\d{17,19}$/.test(id);
}

function searchMessages(query) {
  if (query === null) return;

  const messages = document.querySelectorAll(".message");
  const searchTerm = query.toLowerCase().trim();
  let visibleCount = 0;

  messages.forEach((message) => {
    const content = message.textContent.toLowerCase();

    if (!searchTerm || content.includes(searchTerm)) {
      message.style.display = "block";
      if (searchTerm) {
        message.style.boxShadow = "0 0 15px rgba(124, 58, 237, 0.4)";
        message.style.transform = "translateY(-2px)";
      } else {
        message.style.boxShadow = "";
        message.style.transform = "";
      }
      visibleCount++;
    } else {
      message.style.display = "none";
    }
  });

  updateSearchResults(searchTerm, visibleCount, messages.length);
}

function updateSearchResults(searchTerm, visibleCount, totalCount) {
  let searchResultsDiv = document.getElementById("searchResults");

  if (!searchResultsDiv) {
    searchResultsDiv = document.createElement("div");
    searchResultsDiv.id = "searchResults";
    searchResultsDiv.style.cssText = `
      background: rgba(124, 58, 237, 0.1);
      border: 1px solid var(--primary-color);
      border-radius: 8px;
      padding: 0.75rem;
      margin-bottom: 1rem;
      text-align: center;
      color: var(--primary-color);
    `;
    document
      .querySelector(".conversation")
      .insertBefore(
        searchResultsDiv,
        document.getElementById("conversationMessages")
      );
  }

  if (searchTerm) {
    searchResultsDiv.innerHTML = `
      <i class="fas fa-search"></i> 
      Search: "<strong>${searchTerm}</strong>" - 
      Showing ${visibleCount} of ${totalCount} messages
      <button onclick="clearSearch()" style="margin-left: 1rem; background: none; border: none; color: var(--primary-color); cursor: pointer; text-decoration: underline;">
        Clear
      </button>
    `;
    searchResultsDiv.style.display = "block";
  } else {
    searchResultsDiv.style.display = "none";
  }
}

function clearSearch() {
  searchMessages("");
}

function downloadTranscript() {
  const channelId = getChannelIdFromUrl();
  if (!channelId) {
    alert("No ticket ID available for download.");
    return;
  }

  const transcriptContent = generateTranscriptText();
  const blob = new Blob([transcriptContent], { type: "text/plain" });
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `ticket-transcript-${channelId}.txt`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);
}

function generateTranscriptText() {
  const data = getCurrentTranscriptData();
  let content = "General Information\n\n";

  Object.entries(data.generalInfo).forEach(([key, value]) => {
    content += `${key}: ${value}\n`;
  });

  content += "\nForm Filled\n\n";
  Object.entries(data.formInfo).forEach(([key, value]) => {
    content += `${key}: ${value}\n`;
  });

  if (data.summary) {
    content += "\nTicket Summary\n\n";
    content += data.summary + "\n";
  }

  content += "\nTicket Conversation\n\n";
  data.messages.forEach((message) => {
    content += `[${message.author} at ${message.timestamp}]:\n`;
    if (message.content) {
      content += `Message: ${message.content}\n`;
    }
    message.embeds.forEach((embed) => {
      content += `Embeds: ${embed}\n`;
    });
    content += "\n";
  });

  return content;
}

function getCurrentTranscriptData() {
  return {
    generalInfo: {
      "Ticket Category":
        document.getElementById("ticketCategory")?.textContent || "",
      "Ticket Open at":
        document.getElementById("ticketOpenAt")?.textContent || "",
      "Transcript Save at":
        document.getElementById("ticketSaveAt")?.textContent || "",
      "Opened By": document.getElementById("ticketOpenedBy")?.textContent || "",
      "Closed By": document.getElementById("ticketClosedBy")?.textContent || "",
      "Close Reason":
        document.getElementById("ticketStatus")?.textContent || "",
    },
    formInfo: {
      Issue: document.getElementById("ticketIssue")?.textContent || "",
    },
    summary: document.getElementById("ticketSummary")?.textContent || "",
    messages: Array.from(document.querySelectorAll(".message")).map(
      (messageEl) => {
        const author =
          messageEl.querySelector(".message-author")?.textContent || "";
        const timestamp =
          messageEl.querySelector(".message-timestamp")?.textContent || "";
        const content =
          messageEl.querySelector(".message-content")?.textContent || "";
        const embeds = Array.from(
          messageEl.querySelectorAll(".message-embed")
        ).map((embed) => embed.textContent.replace("Embed: ", "").trim());

        return { author, timestamp, content, embeds };
      }
    ),
  };
}

function refreshTranscript() {
  document.getElementById("transcriptContent").style.display = "none";
  document.getElementById("errorState").style.display = "none";
  document.getElementById("loadingState").style.display = "block";
  loadTranscript();
}

function handleKeyboardShortcuts(e) {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case "f":
        e.preventDefault();
        const searchTerm = prompt("Search in messages:");
        if (searchTerm !== null) {
          searchMessages(searchTerm);
        }
        break;
      case "r":
        e.preventDefault();
        refreshTranscript();
        break;
      case "s":
        e.preventDefault();
        downloadTranscript();
        break;
    }
  }

  if (e.key === "Escape") {
    clearSearch();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadTranscript();

  document.addEventListener("keydown", handleKeyboardShortcuts);

  window.addEventListener("error", (event) => {
    console.error("Unhandled error:", event.error);
  });
});
