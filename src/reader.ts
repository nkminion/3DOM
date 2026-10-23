let port: chrome.runtime.Port | null = null;

function connectPort()
{
	port = chrome.runtime.connect({
		name: "3DOMReader"
	});

	port.onDisconnect.addListener(function() {
		if (chrome.runtime.lastError)
		{
			const ErrorMessage = chrome.runtime.lastError.message;
			console.warn(ErrorMessage);
		}
		DOMObserver.disconnect();
		port = null;
	});
}

connectPort();

window.addEventListener('pagehide', function (event) {
	if (event.persisted && port)
	{
		port.disconnect();
		port = null;
	}
});

window.addEventListener('pageshow', function (event) {
	if (event.persisted && !port)
	{
		connectPort();
	}
});

function CheckAndPostMessage(msg: Record<string,any>)
{
	//Context inactive
	if (!chrome.runtime?.id)
	{
		///Disconnection stuff
		DOMObserver.disconnect();
		port = null;
		return;
	}

	try
	{
		if (port)
		{
			port.postMessage(msg);
		}
	}
	catch (error)
	{
		DOMObserver.disconnect();
		port = null;
	}
}

function TraverseDOM(node: Element, ZIndex: number, tracker: {id: number})
{
	const NodeStyle = window.getComputedStyle(node);
	const NodeRect = node.getBoundingClientRect();
	const NodeTagName = node.tagName;
	let NodeID = "Not Assigned!";
	let NodeClass = "Not Assigned!";

	if (node.hasAttribute('id'))
	{
		NodeID = node.id;
	}
	if (node.hasAttribute('class'))
	{
		NodeClass = node.getAttribute('class')?.toString() || "Not Assigned!";
	}

	const IsVisible = NodeStyle.display != 'none' && NodeRect.width > 0 && NodeRect.height > 0;
	
	/*
		Convert DOM Space coordinates to WebGL Space coordinates
		DOM (0,0) is at top-left corner, WebGL (0,0) is at the center
		Y coords in DOM increases as you go below, Y coords in WebGL decreases as you go below
		Anchor point in DOM is at top-left corner, Anchor point in WebGL is at center
	*/

	const OriginX = NodeRect.x + (NodeRect.width/2);
	const OriginY = NodeRect.y + (NodeRect.height/2);

	const AnchorX = OriginX - (window.innerWidth)/2;
	const AnchorY = -(OriginY - (window.innerHeight)/2);
	const ParsedZIndex = parseFloat(NodeStyle.zIndex);
	const FinalZIndex = isNaN(ParsedZIndex) ? ZIndex : ParsedZIndex;

	if (IsVisible && port)
	{
		CheckAndPostMessage(
			{
				'id': tracker.id,
				'TagName': NodeTagName,
				'DOMID': NodeID,
				'Classes': NodeClass,
				'PosX': AnchorX,
				'PosY': AnchorY,
				'ZIndex': FinalZIndex,
				'Height': NodeRect.height,
				'Width': NodeRect.width
			}
		);
	}

	if (node?.children)
	{
		for (let i=0;i<node.children.length;i++)
		{
			if (node.children[i] instanceof Element)
			{
				tracker.id++;
				TraverseDOM(node.children[i] as Element,ZIndex+1,tracker);
			}
		}
	}
}

let MutationTimeout: ReturnType<typeof setTimeout> | null = null;
let LastRunTime = 0;
const MaxWaitMs = 300;

function ExecuteTraverse()
{
	LastRunTime = Date.now();
	const parent = document.querySelector('body') as Element;
	if (!parent) return;
	TraverseDOM(parent,0,{id: 0});
	if (port)
	{
		CheckAndPostMessage({'DOMLoaded':true});
	}
}

function ScheduleTraverse()
{
	const now = Date.now();
	if (now-LastRunTime > MaxWaitMs)
	{
		if (MutationTimeout)
		{
			clearTimeout(MutationTimeout);
			MutationTimeout = null;
		}
		ExecuteTraverse();
		return;
	}
	if (MutationTimeout)
	{
		clearTimeout(MutationTimeout);
	}
	MutationTimeout = setTimeout(function() {
		ExecuteTraverse();
	},150);
	
}

const DOMObserver = new MutationObserver(ScheduleTraverse);

const LayoutObserver = new ResizeObserver(ScheduleTraverse);

function init()
{
	console.log('DOM Loaded');
	//Traverse DOM
	const parent = document.querySelector('body') as Element;
	if (!parent) return;

	TraverseDOM(parent,0,{id: 0});
	if (port)
	{
		CheckAndPostMessage({'DOMLoaded':true});
	}

	DOMObserver.observe(parent, {
		childList: true,
		subtree: true,
		attributes: true
	});

	LayoutObserver.observe(parent);
}

window.addEventListener('scroll', ScheduleTraverse);
window.addEventListener('animationend', ScheduleTraverse);
window.addEventListener('transitionend', ScheduleTraverse);
window.addEventListener('resize', ScheduleTraverse);
window.addEventListener('load', ScheduleTraverse);

if (document.readyState === 'loading')
{
	document.addEventListener('DOMContentLoaded', init);
}
else
{
	init();
}