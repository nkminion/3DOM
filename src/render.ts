import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

interface CommMsg
{
	id: number,
	TagName: string,
	DOMID: string,
	Classes: string,
	PosX: number,
	PosY: number,
	ZIndex: number,
	Height: number,
	Width: number
}

const port = chrome.runtime.connect({
	name: `3DOMRender-${chrome.devtools.inspectedWindow.tabId}`
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(90,window.innerWidth/window.innerHeight,0.1,10000);
const renderer = new THREE.WebGLRenderer();
const controls = new OrbitControls( camera, renderer.domElement );
const raycaster = new THREE.Raycaster();
let NewDOMBuffer: Array<CommMsg> = [];
let CurrentDOMBuffer: Array<CommMsg> = [];
let MaxZ = -1;
let ActiveDOMGroup = new THREE.Group();

const gui = new GUI();
const OptionsFolder = gui.addFolder('Options');
const InfoFolder = gui.addFolder('Details');

let RenderSettings = {
	Scale: 0.5,
	OnlyDims: false,
	Depth: 5,
	Gap: 10
};

let RenderInfo = {
	TagName: "",
	DOMID: "",
	Classes: "",
	PosX: "",
	PosY: "",
	ZIndex: "",
	Height: "",
	Width: "",
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
			if (Array.isArray(node.material))
			{
				node.material.forEach(m => m.dispose());
			}
			else
			{
				node.material.dispose();
			}
		}
	}
}

function getMouseVector2(event: MouseEvent,window: Window)
{
	let mousePointer = new THREE.Vector2();

	mousePointer.x = (event.clientX / window.innerWidth) * 2 - 1;
	mousePointer.y = -(event.clientY/window.innerHeight) * 2 + 1;

	return mousePointer;
}

function checkRayIntersection(mousePointer: THREE.Vector2, camera: THREE.PerspectiveCamera, raycaster: THREE.Raycaster, scene: THREE.Scene)
{
	raycaster.setFromCamera(mousePointer,camera);

	let intersection = raycaster.intersectObjects(scene.children,true);

	return intersection[0];
}

function onMouseMove(event: MouseEvent)
{
	let mousePointer = getMouseVector2(event,window);

	const intersection = checkRayIntersection(mousePointer,camera,raycaster,scene);

	if (intersection)
	{
		const TargetID = parseInt(intersection.object.name);
		const BufferInfo = CurrentDOMBuffer.find(item => item['id'] === TargetID);
		if (BufferInfo)
		{
			for (const key in RenderInfo)
			{
				if (RenderInfo.hasOwnProperty(key))
				{
					RenderInfo[key as keyof typeof RenderInfo] = BufferInfo[key as keyof typeof BufferInfo].toString();
				}
			}
		}
	}
	else
	{
		for (const key in RenderInfo)
		{
			if (RenderInfo.hasOwnProperty(key))
			{
				RenderInfo[key as keyof typeof RenderInfo] = "";
			}
		}
	}

	gui.controllersRecursive().forEach(controller => {
		controller.updateDisplay();
	});
}

async function RenderDOM(buffer: Array<CommMsg>)
{
	const StagingGroup = new THREE.Group();
	for (const [_,DOMElement] of buffer.entries())
	{
		const SafeZ = MaxZ === 0 ? 1 : MaxZ;
		const ZColor = (Math.min(DOMElement['ZIndex'],MaxZ)/SafeZ)*306;
		const geometry = new THREE.BoxGeometry((DOMElement['Width']*RenderSettings.Scale),(DOMElement['Height']*RenderSettings.Scale),RenderSettings.Depth * (RenderSettings.OnlyDims ? 1 : RenderSettings.Scale)); //width,height,depth
		const material = new THREE.MeshBasicMaterial({color: new THREE.Color(`hsl(${ZColor},100%,50%)`)});
		const cube = new THREE.Mesh(geometry,material);
		cube.name = DOMElement['id'].toString();
		cube.position.set((DOMElement['PosX']*RenderSettings.Scale),(DOMElement['PosY']*RenderSettings.Scale),(DOMElement['ZIndex']*RenderSettings.Gap));
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

document.addEventListener('mousemove', onMouseMove);

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
		MaxZ = Math.max(MaxZ,msg['ZIndex']);
	}
});

const DepthController = OptionsFolder.add(RenderSettings, 'Depth', 1, 50, 1).onFinishChange(async function () {
	await RenderDOM(CurrentDOMBuffer);
});

const GapController = OptionsFolder.add(RenderSettings, 'Gap', 0, 50, 1).onFinishChange(async function () {
	await RenderDOM(CurrentDOMBuffer);
});

OptionsFolder.add(RenderSettings, 'OnlyDims')

OptionsFolder.add(RenderSettings, 'Scale', 0.1, 1).onFinishChange(async function () {
	if (!RenderSettings.OnlyDims)
	{
		RenderSettings.Depth = Math.max(1,RenderSettings.Depth*RenderSettings.Scale);
		RenderSettings.Gap *= RenderSettings.Scale;

		DepthController.updateDisplay();
		GapController.updateDisplay();
	}

	await RenderDOM(CurrentDOMBuffer);
});

InfoFolder.add(RenderInfo,'TagName').disable();
InfoFolder.add(RenderInfo,'DOMID').disable();
InfoFolder.add(RenderInfo,'Classes').disable();
InfoFolder.add(RenderInfo,'PosX').disable();
InfoFolder.add(RenderInfo,'PosY').disable();
InfoFolder.add(RenderInfo,'ZIndex').disable();
InfoFolder.add(RenderInfo,'Height').disable();
InfoFolder.add(RenderInfo,'Width').disable();