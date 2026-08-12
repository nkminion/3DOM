const PortDirectory: Record<number,chrome.runtime.Port> = {};

chrome.runtime.onConnect.addListener(function(port) {
	if (port.name === '3DOMReader')
	{
		port.onDisconnect.addListener(function() {
			if (chrome.runtime.lastError)
			{
				const ErrorMessage = chrome.runtime.lastError.message;
			}
		});
		
		port.onMessage.addListener(function(msg) {
			const TabID = port.sender?.tab?.id;
			if (TabID !== undefined)
			{
				if (PortDirectory[TabID])
				{
					PortDirectory[TabID].postMessage(msg);
				}
			}
		});
	}
	else
	{
		const parts = port.name.split('-');

		if (parts[0] === '3DOMRender' && parts[1])
		{
			const TabID = parseInt(parts[1]);
			PortDirectory[TabID] = port;
			console.log('Added port');
			port.onDisconnect.addListener(function() {
				delete PortDirectory[TabID];
			});
		}
	}
});

