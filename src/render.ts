import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI,Controller } from 'lil-gui';

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
let CurrentMaxZ = -1;
let ActiveDOMGroup = new THREE.Group();
let HasFittedCamera = false;

const gui = new GUI();
const OptionsFolder = gui.addFolder('Options');
const InfoFolder = gui.addFolder('Details');

const DefaultSettings = {
	Scale: 0.5,
	Depth: 5,
	Gap: 10
}

let RenderSettings = {
	Scale: DefaultSettings.Scale,
	OnlyDims: false,
	Depth: DefaultSettings.Depth,
	Gap: DefaultSettings.Gap,
	BaseDepth: 5,
	BaseGap: 10,
	'Reset View': function() {
		this.Scale = DefaultSettings.Scale;
		this.Depth = DefaultSettings.Depth;
		this.Gap = DefaultSettings.Gap;

		OptionsFolder.controllersRecursive().forEach(c => c.updateDisplay());
		FitCamera(camera, controls, ActiveDOMGroup);
	}
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

function FitCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls, RootObject: THREE.Object3D, OffsetFactor: number = 1.25) : void
{
	const box = new THREE.Box3().setFromObject(RootObject);

	if (box.isEmpty())
	{
		return;
	}

	const size = new THREE.Vector3();
	const center = new THREE.Vector3();
	box.getSize(size);
	box.getCenter(center);

	const FovRad = (camera.fov * Math.PI) / 180;

	let distance = (size.y / 2) / Math.tan(FovRad / 2);

	const HFov = 2 * Math.atan(Math.tan(FovRad / 2) * camera.aspect);
	const horizontalDistance = (size.x / 2) / Math.tan(HFov / 2);

	distance = Math.max(distance, horizontalDistance) * OffsetFactor;

	camera.position.set(
	center.x + distance * 0.5,
	center.y + distance * 0.5,
	center.z + distance
	);

	camera.near = Math.max(0.1, distance / 100);
	camera.far = Math.max(1000, distance * 10);
	camera.updateProjectionMatrix();

	if (controls)
	{
		controls.target.copy(center);
		controls.update();
	}
	else
	{
		camera.lookAt(center);
	}
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
				if (Object.prototype.hasOwnProperty.call(RenderInfo,key))
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
			if (Object.prototype.hasOwnProperty.call(RenderInfo,key))
			{
				RenderInfo[key as keyof typeof RenderInfo] = "";
			}
		}
	}

	gui.controllersRecursive().forEach(controller => {
		controller.updateDisplay();
	});
}

function ScaleZ(ZIndex: number): number
{
	if (ZIndex === 0)
	{
		return 0;
	}

	const sign = Math.sign(ZIndex);
	const abs = Math.abs(ZIndex);
	const Threshold = 30;

	let scaled: number;

	if (abs <= Threshold)
	{
		scaled = abs;
	}
	else
	{
		scaled = Threshold + Math.log1p(abs-Threshold) * 3;
	}

	return sign * scaled;
}

function RenderDOM(buffer: Array<CommMsg>)
{
	const StagingGroup = new THREE.Group();
	for (const DOMElement of buffer)
	{
		const ClampedZ = Math.max(0,Math.min(DOMElement['ZIndex'],CurrentMaxZ));
		const SafeZScaled = ScaleZ(CurrentMaxZ) || 1;
		const ElementScaled = ScaleZ(ClampedZ);

		const ZColor = (ElementScaled/SafeZScaled)*0.85;
		const ZPos = ScaleZ(DOMElement['ZIndex']) * RenderSettings.Gap;

		const geometry = new THREE.BoxGeometry((DOMElement['Width']*RenderSettings.Scale),(DOMElement['Height']*RenderSettings.Scale),RenderSettings.Depth * (RenderSettings.OnlyDims ? 1 : RenderSettings.Scale)); //width,height,depth
		const material = new THREE.MeshBasicMaterial({color: new THREE.Color().setHSL(ZColor,1,0.5)});
		const cube = new THREE.Mesh(geometry,material);
		cube.name = DOMElement['id'].toString();
		cube.position.set((DOMElement['PosX']*RenderSettings.Scale),(DOMElement['PosY']*RenderSettings.Scale),(ZPos));
		StagingGroup.add(cube);
	}
	scene.remove(ActiveDOMGroup);
	scene.add(StagingGroup);
	Clear(ActiveDOMGroup);
	ActiveDOMGroup = StagingGroup;
}

function MakeReadOnly(controller: Controller)
{
	controller.domElement.style.pointerEvents = 'none';
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
		CurrentMaxZ = MaxZ;
		RenderDOM(NewDOMBuffer);
		
		if (!HasFittedCamera)
		{
			FitCamera(camera,controls,ActiveDOMGroup);
			HasFittedCamera = true;
		}
		[CurrentDOMBuffer, NewDOMBuffer] = [NewDOMBuffer, CurrentDOMBuffer];
		NewDOMBuffer.length = 0;
		MaxZ = -1;
	}
	else
	{
		NewDOMBuffer.push(msg);
		MaxZ = Math.max(MaxZ,msg['ZIndex']);
	}
});

const DepthController = OptionsFolder.add(RenderSettings, 'Depth', 1, 50, 1).onFinishChange(async function () {
	RenderSettings.BaseDepth = RenderSettings.Depth;
	RenderDOM(CurrentDOMBuffer);
});

const GapController = OptionsFolder.add(RenderSettings, 'Gap', 0, 50, 1).onFinishChange(async function () {
	RenderSettings.BaseGap = RenderSettings.Gap;
	RenderDOM(CurrentDOMBuffer);
});

OptionsFolder.add(RenderSettings, 'OnlyDims')

OptionsFolder.add(RenderSettings, 'Scale', 0.1, 1).onFinishChange(async function () {
	if (!RenderSettings.OnlyDims)
	{
		RenderSettings.Depth = Math.max(1,RenderSettings.BaseDepth*RenderSettings.Scale);
		RenderSettings.Gap = RenderSettings.BaseGap * RenderSettings.Scale;

		DepthController.updateDisplay();
		GapController.updateDisplay();
	}

	RenderDOM(CurrentDOMBuffer);
});

OptionsFolder.add(RenderSettings, 'Reset View');

MakeReadOnly(InfoFolder.add(RenderInfo,'TagName'));
MakeReadOnly(InfoFolder.add(RenderInfo,'DOMID'));
MakeReadOnly(InfoFolder.add(RenderInfo,'Classes'));
MakeReadOnly(InfoFolder.add(RenderInfo,'PosX'));
MakeReadOnly(InfoFolder.add(RenderInfo,'PosY'));
MakeReadOnly(InfoFolder.add(RenderInfo,'ZIndex'));
MakeReadOnly(InfoFolder.add(RenderInfo,'Height'));
MakeReadOnly(InfoFolder.add(RenderInfo,'Width'));