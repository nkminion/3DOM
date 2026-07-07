const port = chrome.runtime.connect({
	name: "3DOMReader"
});

function TraverseDOM(node: HTMLElement)
{
	const NodeStyle = window.getComputedStyle(node);

	if (NodeStyle.display === 'none')
	{
		return;
	}
	
	/*
		Convert DOM Space coordinates to WebGL Space coordinates
		DOM (0,0) is at top-left corner, WebGL (0,0) is at the center
		Y coords in DOM increases as you go below, Y coords in WebGL decreases as you go below
		Anchor point in DOM is at top-left corner, Anchor point in WebGL is at center
	*/

	const OriginX = parseFloat(NodeStyle.x) + (parseFloat(NodeStyle.width)/2);
	const OriginY = parseFloat(NodeStyle.y) + (parseFloat(NodeStyle.height)/2);

	const AnchorX = OriginX - (window.innerWidth)/2;
	const AnchorY = -(OriginY - (window.innerHeight)/2);

	console.log([AnchorX,AnchorY,NodeStyle.width,NodeStyle.height]);

	if (node?.children)
	{
		for (let i=0;i<node.children.length;i++)
		{
			if (node.children[i] instanceof HTMLElement)
			{
				TraverseDOM(node.children[i] as HTMLElement);
			}
		}
	}
}


console.log('DOM Loaded');
//Traverse DOM
const parent = document.querySelector('body') as HTMLElement;
TraverseDOM(parent);