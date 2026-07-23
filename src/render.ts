import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

interface CommMsg
{
	[key: string]: number;
}

const port = chrome.runtime.connect({
	name: `3DOMRender-${chrome.devtools.inspectedWindow.tabId}`
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(90,window.innerWidth/window.innerHeight,0.1,10000);
const renderer = new THREE.WebGLRenderer();
const controls = new OrbitControls( camera, renderer.domElement );
let NewDOMBuffer: Array<CommMsg> = [];
let CurrentDOMBuffer: Array<CommMsg> = [];
let MaxZ = -1;
let ActiveDOMGroup = new THREE.Group();

const gui = new GUI();

let RenderSettings = {
	Scale: 0.5,
	OnlyDims: false,
	Depth: 5,
	Gap: 10
};

renderer.setSize(window.innerWidth,window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);
camera.position.z = 5;

if (chrome.devtools.panels.themeName === 'dark')
{
	scene.background = new THREE.Color(0x222222);
	gui.domElement.classList.add('DarkGUI');
}
else
{
	scene.background = new THREE.Color(0xdedede);
	gui.domElement.classList.add('LightGUI');
}

function animate()
{
	controls.update();
	renderer.render(scene,camera);
}

function Clear(node: THREE.Object3D)
{
	while (node.children.length > 0)
	{
		Clear(node.children[0]);
		node.remove(node.children[0]);
	}
	if (node instanceof THREE.Mesh)
	{
		if (node.geometry)
		{
			node.geometry.dispose();
		}
		if (node.material)
		{
			Object.keys(node.material).forEach(function(property) {
				if (!node.material[property])
				{
					return;
				}
				if (node.material[property] !== null && typeof node.material[property].dispose === 'function')
				{
					node.material[property].dispose();
				}
			});
			node.material.dispose();
		}
	}
}

async function RenderDOM(buffer: Array<CommMsg>)
{
	const StagingGroup = new THREE.Group();
	for (const [_,DOMElement] of buffer.entries())
	{
		const ZColor = (Math.min(DOMElement['z'],MaxZ)/MaxZ)*306;
		const geometry = new THREE.BoxGeometry((DOMElement['w']*RenderSettings.Scale),(DOMElement['h']*RenderSettings.Scale),RenderSettings.Depth); //width,height,depth
		const material = new THREE.MeshBasicMaterial({color: new THREE.Color(`hsl(${ZColor},100%,50%)`)});
		const cube = new THREE.Mesh(geometry,material);
		cube.position.set((DOMElement['x']*RenderSettings.Scale),(DOMElement['y']*RenderSettings.Scale),(DOMElement['z']*RenderSettings.Gap));
		StagingGroup.add(cube);
	}
	scene.remove(ActiveDOMGroup);
	scene.add(StagingGroup);
	Clear(ActiveDOMGroup);
	ActiveDOMGroup = StagingGroup;
}

window.addEventListener('resize', function() {
	camera.aspect = window.innerWidth/window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth,window.innerHeight);
});



port.onMessage.addListener(function(msg) {
	if (msg['DOMLoaded'])
	{
		RenderDOM(NewDOMBuffer);
		[CurrentDOMBuffer, NewDOMBuffer] = [NewDOMBuffer, CurrentDOMBuffer];
		NewDOMBuffer.length = 0;
	}
	else
	{
		NewDOMBuffer.push(msg);
		MaxZ = Math.max(MaxZ,msg['z']);
	}
});

const DepthController = gui.add(RenderSettings, 'Depth', 1, 50, 1).onFinishChange(async function () {
	await RenderDOM(CurrentDOMBuffer);
});

const GapController = gui.add(RenderSettings, 'Gap', 0, 50, 1).onFinishChange(async function () {
	await RenderDOM(CurrentDOMBuffer);
});

gui.add(RenderSettings, 'OnlyDims')

gui.add(RenderSettings, 'Scale', 0.1, 1).onFinishChange(async function () {
	if (!RenderSettings.OnlyDims)
	{
		RenderSettings.Depth = Math.max(1,RenderSettings.Depth*RenderSettings.Scale);
		RenderSettings.Gap *= RenderSettings.Scale;

		DepthController.updateDisplay();
		GapController.updateDisplay();
	}

	await RenderDOM(CurrentDOMBuffer);
});