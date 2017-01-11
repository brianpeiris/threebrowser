const $ = document.querySelector.bind(document);

function getFile(directoryEntry, file) {
	return new Promise(fileResolve => {
		directoryEntry.getFile(
			file.name.replace('.obj', '.mtl'), null,
			mtlFile => fileResolve([{obj: file, mtl: mtlFile}]),
			error => fileResolve([{obj: file, mtl: null}])
		);
	});
}

function getObjFiles(directoryEntry) {
	return new Promise(resolve => {
		directoryEntry.createReader().readEntries(files => {
			const promises = [];
			for (const file of files) {
				if (file.isDirectory) {
					promises.push(getObjFiles(file));
				}
				else if (file.name.endsWith('.obj')) {
					promises.push(getFile(directoryEntry, file));
				}
			}
			if (!promises.length) {
				resolve([]);
			}
			Promise.all(promises).then(results => {
				let objs = [];
				for (result of results) {
					objs = objs.concat(result);
				}
				resolve(objs);
			});
		});
	});
}

const mtlLoader = new THREE.MTLLoader();
const objLoader = new THREE.OBJLoader();
const reader = new FileReader();

const scene = new THREE.Scene();
const light = new THREE.PointLight();
light.position.set(6, 3, 0);
scene.add(light);
scene.add(new THREE.AmbientLight(0xbbbbbb));
scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({color: 'red'})));

const camera = new THREE.PerspectiveCamera( 75, 1, 0.1, 1000);
camera.position.set(3, 3, 3);
camera.lookAt(scene.position);
const canvas = $('canvas');
const renderer = new THREE.WebGLRenderer({canvas: canvas});
renderer.setSize(200, 200);
renderer.setClearColor(0xeeeeee);
renderer.render(scene, camera);
const box = new THREE.Box3();

function generatePreviews(lis, pairs, i) {
	const pair = pairs[i];
	if (!pair.mtl) {
		const j = i + 1;
		if (j < pairs.length) {
			setTimeout(() => generatePreviews(lis, pairs, j), 500);
		}
		return;
	}
	pair.mtl.file(mtlFile => {
		const mtlReader = new FileReader();
		mtlReader.onload = () => {
			pair.obj.file(objFile => {
				const materials = mtlLoader.parse(mtlReader.result);
				const objReader = new FileReader();
				objReader.onload = () => {
					objLoader.setMaterials(materials);
					const obj = objLoader.parse(objReader.result);
					scene.remove(scene.children.slice(-1)[0]);
					scene.add(obj);
					box.setFromObject(obj);
					const size = box.getSize();
					obj.position.set(size.x * -0.5, size.y * -0.5, size.z * 0.5);
					const radius = Math.max(size.x, size.y, size.z) * 3/4;
					light.position.set(radius * 2, radius * 2, radius / 2);
					camera.position.setScalar(radius);
					camera.lookAt(scene.position);
					renderer.render(scene, camera);
					lis[i].innerHTML += `<img src="${canvas.toDataURL()}" />`;
					const j = i + 1;
					if (j < pairs.length) {
						setTimeout(() => generatePreviews(lis, pairs, j), 500);
					}
				}
				objReader.readAsText(objFile);
			});
		};
		mtlReader.readAsText(mtlFile);
	});
}

$('input').addEventListener('change', function () {
	getObjFiles(this.webkitEntries[0]).then(pairs => {
		let html = '';
		for (const pair of pairs) {
			html+=`<li><em>${pair.obj.name.replace('obj', '')}</em><br/></li>`;
		};
		$('ol').innerHTML = html;
		generatePreviews(document.querySelectorAll('li'), pairs, 0);
	});
});
