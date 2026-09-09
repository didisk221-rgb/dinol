let videos = [];
let currentIndex = 0;
let nextEpisodeTimer = null;

const VIDEO_BASE_URL = "https://pub-3d26663746cd47e89dc0e8d2cff7aa33.r2.dev/";

function buildFallbackVideos() {
  const fallbackVideos = [];
  const missingEpisodes = new Set([28, 29, 32, 33, 34, 35, 66]);

  for (let index = 1; index <= 198; index += 1) {
    if (missingEpisodes.has(index)) {
      continue;
    }

    const padded = String(index).padStart(3, "0");
    fallbackVideos.push({
      url: `${VIDEO_BASE_URL}video-${padded}.mp4`
    });
  }

  return fallbackVideos;
}

const loader = document.createElement("div");
loader.id = "loader";
loader.textContent = "Загрузка серии…";
loader.style.cssText = `
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.8);
  color: #fff;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  opacity: 0;
  pointer-events: none;
  transition: opacity .3s;
`;
document.body.appendChild(loader);

function showLoader() {
  loader.style.opacity = 1;
}

function hideLoader() {
  loader.style.opacity = 0;
  loader.style.pointerEvents = "none";
}

function clearCountdown() {
  if (nextEpisodeTimer) {
    clearInterval(nextEpisodeTimer);
    nextEpisodeTimer = null;
  }

  const countdown = document.getElementById("countdown");
  if (countdown) {
    countdown.remove();
  }
}

function setStatus(message) {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = message;
  }
}

function saveLastEpisode(index) {
  try {
    localStorage.setItem("lastEpisode", String(index));
  } catch (error) {
    console.warn("Episode position could not be saved.", error);
  }
}

async function loadVideos() {
  try {
    const response = await fetch("videos.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load videos.json");
    }

    const data = await response.json();
    const list = Array.isArray(data) ? data : data.videos;

    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("videos.json is empty or invalid");
    }

    videos = list;
    setStatus("");
  } catch (error) {
    console.error("Error loading videos:", error);
    videos = buildFallbackVideos();
    setStatus("Список серій завантажено з резервного джерела.");
  }
}

function readSavedEpisode() {
  try {
    const saved = Number(localStorage.getItem("lastEpisode"));
    return Number.isInteger(saved) && saved >= 0 && saved < videos.length ? saved : 0;
  } catch (error) {
    console.warn("Saved episode could not be read.", error);
    return 0;
  }
}

function playVideo(index, shouldPlay = true) {
  if (!videos.length) {
    return;
  }

  currentIndex = (index + videos.length) % videos.length;

  const player = document.getElementById("player");
  const selector = document.getElementById("selector");

  if (!player || !selector) {
    return;
  }

  clearCountdown();
  showLoader();

  const currentVideo = videos[currentIndex];
  if (!currentVideo || !currentVideo.url) {
    setStatus("Некоректне посилання на відео.");
    return;
  }

  selector.value = String(currentIndex);

  if (window.location.protocol === "file:") {
    hideLoader();
    setStatus("Для локального файлу відео відкривається в новій вкладці.");
    if (shouldPlay) {
      window.open(currentVideo.url, "_blank", "noopener,noreferrer");
    }
    return;
  }

  player.src = currentVideo.url;

  player.load();
  player.oncanplay = () => {
    hideLoader();
    setStatus("");
  };
  player.onerror = () => {
    hideLoader();
    setStatus("Відео не завантажилось. Відкрийте сайт через його https-посилання.");
  };

  if (shouldPlay) {
    player.play().catch((error) => {
      hideLoader();
      if (error.name !== "NotAllowedError") {
        setStatus("Натисніть кнопку відтворення у відеоплеєрі.");
      }
    });
  }

  saveLastEpisode(currentIndex);
}

function fillSelector() {
  const selector = document.getElementById("selector");
  if (!selector) {
    return;
  }

  selector.innerHTML = "";

  videos.forEach((video, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `Серія ${index + 1}`;
    selector.appendChild(option);
  });

  selector.onchange = () => {
    playVideo(parseInt(selector.value, 10));
  };
}

function bindButtons() {
  const randomButton = document.getElementById("random");
  const nextButton = document.getElementById("next");
  const prevButton = document.getElementById("prev");

  if (randomButton) {
    randomButton.addEventListener("click", () => {
      if (!videos.length) return;
      const randomIndex = Math.floor(Math.random() * videos.length);
      playVideo(randomIndex);
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", () => {
      if (!videos.length) return;
      playVideo(currentIndex + 1);
    });
  }

  if (prevButton) {
    prevButton.addEventListener("click", () => {
      if (!videos.length) return;
      playVideo(currentIndex - 1);
    });
  }
}

function attachAutoAdvance() {
  const player = document.getElementById("player");
  if (!player) {
    return;
  }

  player.addEventListener("ended", () => {
    if (!videos.length) {
      return;
    }

    let seconds = 5;
    const countdown = document.createElement("div");
    countdown.id = "countdown";
    countdown.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ff00aa;
      color: #fff;
      padding: 15px 20px;
      border-radius: 10px;
      font-size: 20px;
      z-index: 9999;
    `;
    document.body.appendChild(countdown);
    countdown.textContent = `Наступна серія через ${seconds} сек…`;

    nextEpisodeTimer = setInterval(() => {
      seconds -= 1;
      countdown.textContent = `Наступна серія через ${seconds} сек…`;

      if (seconds <= 0) {
        clearInterval(nextEpisodeTimer);
        nextEpisodeTimer = null;
        countdown.remove();
        playVideo(currentIndex + 1);
      }
    }, 1000);
  });
}

function init() {
  videos = buildFallbackVideos();
  fillSelector();
  bindButtons();
  attachAutoAdvance();
  playVideo(readSavedEpisode(), false);

  loadVideos().then(() => {
    fillSelector();
    playVideo(Math.min(currentIndex, videos.length - 1));
  });
}

window.addEventListener("DOMContentLoaded", init);
