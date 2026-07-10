import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const port = chrome.runtime.connect({
	name: `3DOMRender-${chrome.devtools.inspectedWindow.tabId}`
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(90,window.innerWidth/window.innerHeight,0.1,1000);
const renderer = new THREE.WebGLRenderer();
const controls = new OrbitControls( camera, renderer.domElement );

renderer.setSize(window.innerWidth,window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);
camera.position.z = 5;

function animate()
{
	controls.update();
	renderer.render(scene,camera);
}

window.addEventListener('resize', function() {
	camera.aspect = window.innerWidth/window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth,window.innerHeight);
});



port.onMessage.addListener(function(msg) {
	console.log(`From: ${chrome.devtools.inspectedWindow.tabId} | Msg: `,msg);
	const geometry = new THREE.BoxGeometry(msg['w'],msg['h'],5); //width,height,depth
	const material = new THREE.MeshBasicMaterial({color: 0x0000ff});
	const cube = new THREE.Mesh(geometry,material);
	cube.position.set(msg['x'],msg['y'],(msg['z']*10));
	scene.add(cube);
});