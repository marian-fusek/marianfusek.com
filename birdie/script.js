const readings = {
  humidity: {
    image: 'media/reading-humidity.png',
    alt: 'Humidity reading 43 percent',
  },
  temperature: {
    image: 'media/reading-temperature.png',
    alt: '17 degrees',
  },
  aqi: {
    image: 'media/reading-aqi.png',
    alt: 'Air quality index 27',
  },
  mold: {
    image: 'media/reading-mold.png',
    alt: 'Mold reading 3',
  },
  air: {
    image: 'media/reading-low.png',
    alt: 'Low air reading',
  },
};

const readingDemo = document.querySelector('.reading-demo');
const readingCore = document.querySelector('.reading-core');
const readingCoreImage = document.querySelector('.reading-core-image');
const readingButtons = [...document.querySelectorAll('.reading-pill[data-reading-key]')];
const readingKeys = Object.keys(readings);

function setReading(key) {
  const reading = readings[key];
  if (!reading) return;

  readingDemo.dataset.reading = key;
  readingCoreImage.src = reading.image;
  readingCoreImage.alt = reading.alt;
  readingCore.setAttribute('aria-label', reading.alt + '. Change reading');

  readingButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.readingKey === key);
  });
}

function cycleReading() {
  const currentKey = readingDemo.dataset.reading || 'humidity';
  const currentIndex = readingKeys.indexOf(currentKey);
  const nextKey = readingKeys[(currentIndex + 1) % readingKeys.length];
  setReading(nextKey);
}

readingButtons.forEach((button) => {
  button.addEventListener('click', () => setReading(button.dataset.readingKey));
});

readingCore.addEventListener('click', cycleReading);
setReading('humidity');
