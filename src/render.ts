import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
const DOMBuffer: Array<CommMsg> = [];
let MaxZ = -1;

renderer.setSize(window.innerWidth,window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);
camera.position.z = 5;

if (chrome.devtools.panels.themeName === 'dark')
{
	scene.background = new THREE.Color(0x222222);
}
else
{
	scene.background = new THREE.Color(0xdedede);
}

function animate()
{
	controls.update();
	renderer.render(scene,camera);
}

function RenderDOM()
{
	for (const [_,DOMElement] of DOMBuffer.entries())
	{
		const ZColor = (Math.min(DOMElement['z'],MaxZ)/MaxZ)*306;
		const geometry = new THREE.BoxGeometry(DOMElement['w'],DOMElement['h'],5); //width,height,depth
		const material = new THREE.MeshBasicMaterial({color: new THREE.Color(`hsl(${ZColor},100%,50%)`)});
		const cube = new THREE.Mesh(geometry,material);
		cube.position.set(DOMElement['x'],DOMElement['y'],(DOMElement['z']*10));
		scene.add(cube);
	}
}

window.addEventListener('resize', function() {
	camera.aspect = window.innerWidth/window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth,window.innerHeight);
});



port.onMessage.addListener(function(msg) {
	console.log(`From: ${chrome.devtools.inspectedWindow.tabId} | Msg: `,msg);
	if (msg['DOMLoaded'])
	{
		RenderDOM();
		DOMBuffer.length = 0;
	}
	else
	{
		DOMBuffer.push(msg);
		MaxZ = Math.max(MaxZ,msg['z']);
	}
});