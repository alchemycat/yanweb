const { executablePath } = require("puppeteer");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
const fs = require("fs");
const cluster = require("node:cluster");
const figlet = require("figlet");
const gradient = require("gradient-string");
const schedule = require("node-schedule");
const chalk = require("chalk");
const axios = require("axios");
require("dotenv").config();

//Мои модули
const { Session } = require("./modules/Session");
const { Google } = require("./modules/Google");
const { Yandex } = require("./modules/Yandex");
const { Telegram } = require("./modules/Telegram");
const { Captcha } = require("./modules/Captcha");
const { YandexWeb } = require("./modules/YandexWeb");

const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatID = process.env.TELEGRAM_CHAT_ID;
const captchaAPI = process.env.CAPTCHA_API;

const use_schedule = false; // использовать планировщик или нет
const threads_count = 1; // количество потоков

let isWorking = false;

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

if (!fs.existsSync(`${__dirname}/state.json`)) {
	fs.writeFileSync(`${__dirname}/state.json`, '{"working": false}');
}

const state = fs.readFileSync(`${__dirname}/state.json`, { encoding: "utf-8" });

// `0 8,20 * * *`

if (use_schedule) {
	const job = schedule.scheduleJob(`*/20 * * * *`, function () {
		init();
	});
	const date = new Date(
		job.pendingInvocations[0].fireDate,
	).toLocaleTimeString();

	console.log(`Запуск запланирован на: ${date}`);
} else {
	init();
}

async function init() {
	if (cluster.isMaster) {
		await new Promise((resolve) => {
			figlet("Yandex Webmaster Checker", function (err, data) {
				if (err) {
					console.log("Что-то пошло не так...");
					console.dir(err);
					return;
				}
				console.log(gradient.retro(data));
				resolve();
			});
		});

		//главный поток начинает работу, инициализирует данные
		// const threads_count = prompt(chalk.bold("Количество потоков? "));
		console.log(`Количество потоков: ${threads_count}`);
		let global_counter = 0;

		if (!fs.existsSync(`${__dirname}/profiles`)) {
			fs.mkdirSync(`${__dirname}/profiles`);
		}

		//Валидация
		if (!fs.existsSync(`${__dirname}/data.json`))
			return console.log(
				`Файл data.json не найден. Создайте файл по пути: ${__dirname}/data.json`,
			);

		let data = fs.readFileSync(`${__dirname}/data.json`, { encoding: "utf-8" });

		if (!data) return console.log("В файле data.json нету данных.");

		try {
			data = JSON.parse(data);
		} catch {
			return console.log(
				"Некорректный формат данных в файле data.json, добавьте данные в json формате.",
			);
		}

		if (!data.length) return console.log("В файле data.json нету данных.");
		/////-----

		for (let i = 0; i < threads_count; i++) {
			//вызываем воркеры
			const worker = await cluster.fork();
			global_counter++;
			await worker.send({
				global_counter,
				data,
				thread_name: `[Поток ${i + 1}]`,
			});
		}

		cluster.on("message", async (worker, msg, handle) => {
			if (msg.message === "get_data") {
				if (global_counter < data.length) {
					global_counter++;
					await worker.send({
						global_counter,
						data: data,
						thread_name: msg.thread_name,
					});
				} else {
					worker.kill();
				}
			}
		});

		cluster.on("exit", (worker) => {
			let workersLength = Object.keys(cluster.workers).length;
			//if workers length === 0 ? isWorking = false
			console.log(`Закрываю поток`);
		});
	} else {
		process.on("message", async (msg) => {
			const { global_counter, data, thread_name } = msg;

			if (!data[global_counter - 1]) {
				process.exit();
			} else {
				const { token, login, pass, answer, url } = data[global_counter - 1];

				let loginName = login;

				if (/.*(?=@)/.test(login)) {
					loginName = login.match(/.*(?=@)/)[0];
				}

				const sessionFolder = `${__dirname}/profiles/${loginName}`;

				if (!fs.existsSync(sessionFolder)) {
					fs.mkdirSync(sessionFolder);
				}

				let result = await main(
					sessionFolder,
					token,
					login,
					pass,
					answer,
					url,
					thread_name,
					loginName,
				);

				if (!result)
					console.log(
						`Для аккаунта: ${login} не удалось выполнить проверку доменов`,
					);

				console.log(`${chalk.bold(thread_name)} Проверка завершена`);

				process.send({ message: "get_data", thread_name });
			}
		});
	}
}

// init();

async function main(
	sessionFolder,
	token,
	login,
	pass,
	answer,
	url,
	thread_name,
	loginName,
) {
	const google = new Google();
	const yandex = new Yandex(token);
	const telegram = new Telegram(telegramToken, telegramChatID);
	const captcha = new Captcha(captchaAPI, "yandexwave");

	await yandex.getUserID();

	let hosts = [];

	const tempHost = await yandex.getHosts();

	tempHost.forEach((host) => {
		if (!host.main_mirror) {
			hosts.push(host);
		}
	});

	if (!hosts)
		return console.log("Не удалось получить данные о доменах на аккаунте");

	const browser = await puppeteer.launch({
		headless: false,
		slowMo: 20,
		ignoreHTTPSErrors: true,
		ignoreDefaultArgs: ["--enable-automation"],
		executablePath: executablePath(),
	});

	const page = await browser.newPage();

	const yandexWeb = new YandexWeb(
		page,
		captcha,
		telegram,
		yandex,
		thread_name,
		loginName,
		login,
		pass,
		answer,
	);

	page.setDefaultTimeout(20000);

	const session = new Session(page, sessionFolder);

	await page.goto(
		"https://passport.yandex.com/auth?mode=auth&retpath=https%3A%2F%2Fwebmaster.yandex.com%2Fsites%2F",
	);

	if (fs.existsSync(`${sessionFolder}/cookies.json`)) {
		await session
			.loadSession()
			.then(() => {
				console.log(
					`${chalk.bold(thread_name)} Загрузил профиль: ${chalk.yellow.bold(
						loginName,
					)}`,
				);
			})
			.catch((err) => {
				console.log(err);
				console.log(
					`${chalk.bold(
						thread_name,
					)} Ошибка загрузки профиля: ${chalk.yellow.bold(loginName)}`,
				);
			});
	}

	await page.reload();

	let isLoginFieldExist = false;

	try {
		await page.click('[data-type="login"]', { timeout: 5000 });
	} catch {}

	try {
		isLoginFieldExist = await page.waitForSelector("#passp-field-login", {
			timeout: 8000,
		});
	} catch {}

	let isLoginSuccess;

	//если переменная true тогда нужно выполнить логин
	if (isLoginFieldExist) {
		isLoginSuccess = await yandexWeb.loginToWebmaster();
		if (!isLoginSuccess) return false;
	}

	let selectAccount = false;

	try {
		selectAccount = await page.waitForSelector(
			"a[href='https://webmaster.yandex.com/sites/']",
			{ timeout: 5000 },
		);
	} catch {}

	if (selectAccount) {
		await selectAccount.click();
	}

	let isLoggedIn = false;

	try {
		const captchaButton = await yandexWeb.waitForSelector(
			".CheckboxCaptcha-Button",
			{
				timeout: 5000,
				visible: true,
			},
		);

		console.log("Капча найдена");

		await captchaButton.click();

		let isCaptchaExist = await yandexWeb.checkCaptchaExist(
			".AdvancedCaptcha-Image",
		);

		if (isCaptchaExist) {
			await yandexWeb.setCaptcha(
				".Textinput_view_captcha .Textinput-Control",
				".AdvancedCaptcha-Image",
				".CaptchaButton.CaptchaButton_view_action",
			);
		}
	} catch {
		console.log("advanced captcha not found");
	}

	try {
		isLoggedIn = await page.waitForSelector(".UserID-Account", {
			timeout: 5000,
		});
	} catch {}

	if (!isLoggedIn)
		return console.log(`Не удалось выполнить логин в аккаунт: ${loginName}`);

	if (isLoginFieldExist) {
		session
			.saveSession()
			.then(() => {
				console.log(
					`${chalk.bold(thread_name)} Профиль для аккаунта: ${login} сохранен`,
				);
			})
			.catch((err) => {
				console.log(err);
				console.log(
					`${chalk.bold(
						thread_name,
					)} Не удалось сохранить профиль для аккаунта: ${login}`,
				);
			});
	}

	console.log(
		`${chalk.bold(
			thread_name,
		)} Выполнен вход в аккаунт Яндекс Вебмастер: ${chalk.yellow.bold(
			loginName,
		)}`,
	);

	//здесь уже начинается проверка

	let result = [];

	for (let i = 0; i < hosts.length; i++) {
		let host = hosts[i].host_id;
		let url = hosts[i].unicode_host_url;

		const checkResult = await yandexWeb.checkHost(host, url);
		if (checkResult) {
			result.push(checkResult);
			if (/Невозможно перенести сайт/m.test(checkResult[1])) {
				console.log(
					`${chalk.bold(thread_name)} Невозможно перенести сайт: ${url}`,
				);
				await telegram.sendMessage(`Невозможно перенести сайт: ${url}`);
			}
		}
		// console.log(checkResult);
		await page.waitForTimeout(1000);
		console.log(
			`${chalk.bold(thread_name)} Проверено сайтов: ${chalk.green.bold(
				i + 1 + "/" + hosts.length,
			)}`,
		);
	}

	await google.sendData(result, loginName, url);

	await browser.close();

	return true;
}
