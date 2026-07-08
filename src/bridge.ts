const PortDirectory: Record<number,chrome.runtime.Port> = {};

chrome.runtime.onConnect.addListener(function(port) {
	if (port.name === '3DOMReader')
	{
		port.onMessage.addListener(function(msg){
			console.log(`From: ${port.sender?.tab?.id} | Msg: `,msg);

			if (port.sender?.tab?.id)
			{
				if (PortDirectory[port.sender?.tab?.id])
				{
					PortDirectory[port.sender?.tab?.id].postMessage(msg);
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

