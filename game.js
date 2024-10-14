// game.js

let scene, camera, renderer;
let keys = {};
const speed = 0.2;
let velocityX = 0;
let velocityZ = 0;
let velocityY = 0;
const acceleration = 0.05;
const deceleration = 0.1;
const gravity = -0.05;
let canJump = false;

let pitch = 0;
let yaw = 0;
const sensitivity = 0.002;

const objects = []; // Препятствия
const monsters = []; // Монстры
const playerBeams = []; // Лучи игрока
const monsterBeams = []; // Лучи монстров

let health = 100;
let score = 0;

// HUD элементы
const healthElement = document.getElementById('health');
const scoreElement = document.getElementById('score');

// Ограничение на стрельбу
const shootCooldown = 300; // миллисекунд
let lastShootTime = 0;

// Цвета для счёта (для смены цвета после каждого убийства)
const scoreColors = ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
let currentScoreColorIndex = 0;

// Получение элементов аудио
const shootAudio = document.getElementById('shootAudio');
const enemyDeathAudio = document.getElementById('enemyDeathAudio');
const playerHitAudio = document.getElementById('playerHitAudio');

function getNextScoreColor() {
    currentScoreColorIndex = (currentScoreColorIndex + 1) % scoreColors.length;
    return scoreColors[currentScoreColorIndex];
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 3, 10); // Повышенная позиция камеры

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(100, 100, 100);
    scene.add(directionalLight);

    // Земля с холмами
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000, 200, 200);
    groundGeometry.rotateX(-Math.PI / 2);

    for (let i = 0; i < groundGeometry.attributes.position.count; i++) {
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(groundGeometry.attributes.position, i);
        vertex.y = Math.random() * 3; // Холмы
        groundGeometry.attributes.position.setY(i, vertex.y);
    }
    groundGeometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    scene.add(ground);
    objects.push(ground);

    // Бункеры
    const bunkerGeometry = new THREE.BoxGeometry(20, 12, 20);
    const bunkerMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });

    for (let i = 0; i < 100; i++) {
        const bunker = new THREE.Mesh(bunkerGeometry, bunkerMaterial);
        bunker.position.set(
            Math.random() * 800 - 400,
            6,
            Math.random() * 800 - 400
        );

        // Окна
        const windowGeometry = new THREE.BoxGeometry(4, 4, 0.5);
        const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x0000ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 });
        for (let j = 0; j < 6; j++) {
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.set(
                (j % 3 - 1) * 6,
                2 + Math.floor(j / 3) * 4,
                10.25
            );
            bunker.add(window);
        }

        scene.add(bunker);
        objects.push(bunker);
    }

    // Дополнительные препятствия (скалы)
    const rockGeometry = new THREE.DodecahedronGeometry(2, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });

    for (let i = 0; i < 300; i++) {
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.scale.setScalar(Math.random() * 3 + 1);
        rock.position.set(
            Math.random() * 800 - 400,
            3,
            Math.random() * 800 - 400
        );
        scene.add(rock);
        objects.push(rock);
    }

    // Звёзды
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 10000;
    const starsVertices = [];

    for (let i = 0; i < starsCount; i++) {
        const x = THREE.MathUtils.randFloatSpread(2000);
        const y = THREE.MathUtils.randFloatSpread(2000);
        const z = THREE.MathUtils.randFloatSpread(2000);
        starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // Монстры появляются каждые 5 секунд
    setInterval(spawnMonster, 5000);

    // Анимация
    function animate() {
        requestAnimationFrame(animate);

        // Движение с инерцией
        if (keys["w"]) {
            velocityZ -= Math.cos(yaw) * acceleration;
            velocityX -= Math.sin(yaw) * acceleration;
        }
        if (keys["s"]) {
            velocityZ += Math.cos(yaw) * acceleration;
            velocityX += Math.sin(yaw) * acceleration;
        }
        if (keys["a"]) { // Теперь "A" перемещает вправо
            velocityZ -= Math.cos(yaw + Math.PI / 2) * acceleration;
            velocityX -= Math.sin(yaw + Math.PI / 2) * acceleration;
        }
        if (keys["d"]) { // Теперь "D" перемещает влево
            velocityZ -= Math.cos(yaw - Math.PI / 2) * acceleration;
            velocityX -= Math.sin(yaw - Math.PI / 2) * acceleration;
        }

        // Применение замедления
        velocityX *= (1 - deceleration);
        velocityZ *= (1 - deceleration);

        // Обновление позиции камеры
        camera.position.x += velocityX;
        camera.position.z += velocityZ;

        // Прыжок
        if (canJump) {
            velocityY += gravity;
            camera.position.y += velocityY;

            if (camera.position.y <= 3) { // Убедиться, что камера не опускается ниже 3
                camera.position.y = 3;
                canJump = false;
                velocityY = 0;
            }
        }

        // Обнаружение коллизий
        objects.forEach(obj => {
            if (obj.geometry instanceof THREE.PlaneGeometry) return; // Игнорировать землю
            const distance = camera.position.distanceTo(obj.position);
            if (distance < 10) { // Простое расстояние коллизии
                camera.position.x -= velocityX;
                camera.position.z -= velocityZ;
                velocityX = 0;
                velocityZ = 0;
            }
        });

        // Вращение камеры
        camera.rotation.set(pitch, yaw, 0);

        // Вращение звёзд
        stars.rotation.y += 0.0005;

        // Обновление лучей игрока
        updatePlayerBeams();

        // Обновление лучей монстров
        updateMonsterBeams();

        // Обновление монстров
        updateMonsters();

        // Обновление HUD
        updateHUD();

        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('keydown', function (event) {
        keys[event.key.toLowerCase()] = true;
        if (event.code === 'Space') {
            if (!canJump) {
                velocityY = 0.6; // Более высокий прыжок
                canJump = true;
            }
        }
        if (event.key.toLowerCase() === 'r') {
            respawn();
        }
    });

    window.addEventListener('keyup', function (event) {
        keys[event.key.toLowerCase()] = false;
    });

    // Pointer Lock API
    const instructionsDiv = document.getElementById('instructions');

    instructionsDiv.addEventListener('click', function () {
        renderer.domElement.requestPointerLock();
    }, false);

    document.addEventListener('pointerlockchange', lockChangeAlert, false);
    document.addEventListener('mozpointerlockchange', lockChangeAlert, false);
    document.addEventListener('webkitpointerlockchange', lockChangeAlert, false);

    function lockChangeAlert() {
        if (document.pointerLockElement === renderer.domElement ||
            document.mozPointerLockElement === renderer.domElement ||
            document.webkitPointerLockElement === renderer.domElement) {
            instructionsDiv.style.display = 'none';
            document.addEventListener("mousemove", updateCameraRotation, false);
            document.addEventListener("mousedown", shootPlayerBeam, false);
        } else {
            instructionsDiv.style.display = '';
            document.removeEventListener("mousemove", updateCameraRotation, false);
            document.removeEventListener("mousedown", shootPlayerBeam, false);
        }
    }

    function updateCameraRotation(event) {
        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        yaw -= movementX * sensitivity; // Не инвертировано
        pitch -= movementY * sensitivity; // Не инвертировано

        const PI_2 = Math.PI / 2;
        pitch = Math.max(-PI_2, Math.min(PI_2, pitch));
    }

    function shootPlayerBeam(event) {
        const currentTime = Date.now();
        if (currentTime - lastShootTime < shootCooldown) return; // Ограничение частоты стрельбы
        lastShootTime = currentTime;

        // Воспроизведение звука стрельбы
        if (shootAudio) {
            shootAudio.currentTime = 0;
            shootAudio.play();
            console.log('Played shoot sound');
        }

        // Создание луча
        const beamGeometry = new THREE.CylinderGeometry(0.05, 0.05, 10, 8);
        const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);

        // Позиция луча на камере
        beam.position.copy(camera.position);

        // Направление
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());

        // Добавление луча в сцену
        scene.add(beam);
        playerBeams.push({ mesh: beam, direction: direction.clone() });
    }

    function updatePlayerBeams() {
        for (let i = playerBeams.length - 1; i >= 0; i--) {
            const beam = playerBeams[i];
            beam.mesh.position.add(beam.direction.clone().multiplyScalar(2)); // Движение быстрее

            // Исчезновение
            beam.mesh.material.opacity -= 0.02;
            if (beam.mesh.material.opacity <= 0) {
                scene.remove(beam.mesh);
                playerBeams.splice(i, 1);
                continue;
            }

            // Удаление, если за пределами карты
            if (beam.mesh.position.x < -500 || beam.mesh.position.x > 500 ||
                beam.mesh.position.z < -500 || beam.mesh.position.z > 500) {
                scene.remove(beam.mesh);
                playerBeams.splice(i, 1);
                continue;
            }

            // Коллизия с монстрами
            for (let m = monsters.length - 1; m >= 0; m--) {
                const monster = monsters[m];
                const distance = beam.mesh.position.distanceTo(monster.position);
                if (distance < 5) { // Предполагаемый размер монстра
                    // Воспроизведение звука смерти врага
                    if (enemyDeathAudio) {
                        enemyDeathAudio.currentTime = 0;
                        enemyDeathAudio.play();
                        console.log('Played enemy death sound');
                    }

                    scene.remove(monster);
                    monsters.splice(m, 1);
                    scene.remove(beam.mesh);
                    playerBeams.splice(i, 1);
                    addScore(10);
                    break;
                }
            }
        }
    }

    function spawnMonster() {
        const monster = createRedAstronaut();
        // Случайная позиция далеко от игрока
        const distance = 450;
        const angle = Math.random() * Math.PI * 2;
        monster.position.set(
            Math.cos(angle) * distance,
            2.5,
            Math.sin(angle) * distance
        );

        scene.add(monster);
        monsters.push(monster);

        // Монстр стреляет каждые 3 секунды
        monster.shootInterval = setInterval(() => {
            shootMonsterBeam(monster);
        }, 3000);
    }

    function shootMonsterBeam(monster) {
        const beamGeometry = new THREE.CylinderGeometry(0.05, 0.05, 10, 8);
        const beamMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.7 });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);

        // Позиция луча на монстре
        beam.position.copy(monster.position);

        // Направление к игроку
        const direction = new THREE.Vector3();
        direction.subVectors(camera.position, monster.position).normalize();
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone());

        // Добавление луча в сцену
        scene.add(beam);
        monsterBeams.push({ mesh: beam, direction: direction.clone() });
    }

    function updateMonsterBeams() {
        for (let i = monsterBeams.length - 1; i >= 0; i--) {
            const beam = monsterBeams[i];
            beam.mesh.position.add(beam.direction.clone().multiplyScalar(1.5)); // Движение медленнее

            // Исчезновение
            beam.mesh.material.opacity -= 0.02;
            if (beam.mesh.material.opacity <= 0) {
                scene.remove(beam.mesh);
                monsterBeams.splice(i, 1);
                continue;
            }

            // Удаление, если за пределами карты
            if (beam.mesh.position.x < -500 || beam.mesh.position.x > 500 ||
                beam.mesh.position.z < -500 || beam.mesh.position.z > 500) {
                scene.remove(beam.mesh);
                monsterBeams.splice(i, 1);
                continue;
            }

            // Коллизия с игроком
            const distance = beam.mesh.position.distanceTo(camera.position);
            if (distance < 2.5) { // Размер игрока
                // Воспроизведение звука попадания по игроку
                if (playerHitAudio) {
                    playerHitAudio.currentTime = 0;
                    playerHitAudio.play();
                    console.log('Played player hit sound');
                }

                takeDamage(20);
                scene.remove(beam.mesh);
                monsterBeams.splice(i, 1);
                continue;
            }
        }
    }

    function updateMonsters() {
        for (let i = monsters.length - 1; i >= 0; i--) {
            const monster = monsters[i];
            // Движение монстров к игроку
            const direction = new THREE.Vector3();
            direction.subVectors(camera.position, monster.position).normalize();
            monster.position.add(direction.multiplyScalar(0.05));

            // Предотвращение прохождения монстра через препятствия
            for (let j = 0; j < objects.length; j++) {
                const obj = objects[j];
                if (obj.geometry instanceof THREE.PlaneGeometry) continue; // Игнорировать землю
                const distance = monster.position.distanceTo(obj.position);
                if (distance < 10) { // Простая коллизия
                    monster.position.sub(direction.multiplyScalar(0.05));
                    break;
                }
            }
        }
    }

    function takeDamage(amount) {
        health -= amount;
        health = Math.max(0, health);
        healthElement.textContent = `Helath: ${health}`;
        if (health <= 0) {
            alert("You are dead, try again!");
            window.location.reload();
        }
    }

    function addScore(amount) {
        score += amount;
        scoreElement.textContent = `Счёт: ${score}`;
        // Изменение цвета счёта
        scoreElement.style.color = getNextScoreColor();
    }

    function updateHUD() {
        // Дополнительные обновления HUD можно добавить здесь
    }

    function respawn() {
        // Функция респавна без проверки позиции игрока
        camera.position.set(0, 3, 10); // Высокая позиция спауна
        pitch = 0;
        yaw = 0;
        velocityX = 0;
        velocityZ = 0;
        velocityY = 0;
        canJump = false;
        health = 100;
        score = 0;
        healthElement.textContent = `Здоровье: ${health}`;
        scoreElement.textContent = `Счёт: ${score}`;
        // Сброс цвета счёта на начальный
        scoreElement.style.color = '#ffffff';
    }

    // Обработка изменения размера окна
    window.addEventListener('resize', function () {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    });
}

// Функция создания Красного Астронавта
function createRedAstronaut() {
    const astronaut = new THREE.Group();

    // Тело
    const bodyGeometry = new THREE.CylinderGeometry(1, 1, 4, 32);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 2.5;
    astronaut.add(body);

    // Голова
    const headGeometry = new THREE.SphereGeometry(1, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 4.5;
    astronaut.add(head);

    // Шлем
    const helmetGeometry = new THREE.SphereGeometry(1.2, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const helmetMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5 });
    const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
    helmet.position.y = 4.5;
    helmet.rotation.x = Math.PI;
    astronaut.add(helmet);

    return astronaut;
}

// Инициализация игры после полной загрузки DOM
window.onload = init;
