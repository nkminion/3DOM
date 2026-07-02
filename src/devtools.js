chrome.devtools.panels.create(
	"3DOM", //Title
	"/icons/icon48.png", //Icon,
	"src/index.html",
	(panel) => {
		panel.onShown.addListener(() => {
			console.log("Panel Shown");
		});
	}
);