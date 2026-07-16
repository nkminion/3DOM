const port = chrome.runtime.connect({
	name: "3DOMReader"
});

function TraverseDOM(node: HTMLElement, ZIndex: number)
{
	const NodeStyle = window.getComputedStyle(node);
	const NodeRect = node.getBoundingClientRect();

	if (NodeStyle.display === 'none' || !NodeRect.width || !NodeRect.height)
	{
		return;
	}
	
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

	port.postMessage(
		{
			'x': AnchorX,
			'y': AnchorY,
			'z': NodeStyle.zIndex === 'auto' ? ZIndex : parseFloat(NodeStyle.zIndex),
			'h': NodeRect.height,
			'w': NodeRect.width
		}
	);

	if (node?.children)
	{
		for (let i=0;i<node.children.length;i++)
		{
			if (node.children[i] instanceof HTMLElement)
			{
				TraverseDOM(node.children[i] as HTMLElement,ZIndex+1);
			}
		}
	}
}

let MutationTimeout: ReturnType<typeof setTimeout> | null = null;

const DOMObserver = new MutationObserver(function(mutations,observer){
	if (MutationTimeout)
	{
		clearTimeout(MutationTimeout);
	}
	MutationTimeout = setTimeout(function() {
		console.log('Timeout Fired');
		const parent = document.querySelector('body') as HTMLElement;
		TraverseDOM(parent,0);
		port.postMessage({'DOMLoaded':true});
	},150);
	console.log('DOM Changed');
});

console.log('DOM Loaded');
//Traverse DOM
const parent = document.querySelector('body') as HTMLElement;
TraverseDOM(parent,0);
port.postMessage({'DOMLoaded':true});

DOMObserver.observe(document.body, {
	childList: true,
	subtree: true,
	attributes: true
});