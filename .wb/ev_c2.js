(function () {
  return {text: document.body.innerText.replace(/\s+/g,' ').slice(0, 900), url: location.href};
})()
