const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const prompt = require("prompt-sync")();
const cluster = require("node:cluster");
const figlet = require("figlet");
const gradient = require("gradient-string");
const chalk = require("chalk");
require("dotenv").config();

//Мои модули
const { Session } = require("./modules/Session");
const { Google } = require("./modules/Google");
const { Yandex } = require("./modules/Yandex");
const { Telegram } = require("./modules/Telegram");
const { Captcha } = require("./modules/Captcha");
const { YandexWeb } = require("./modules/YandexWeb");
const { sleep } = require("./modules/sleep");

const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatID = process.env.TELEGRAM_CHAT_ID;
const captchaAPI = process.env.CAPTCHA_API;

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
		const threads_count = prompt(chalk.bold("Количество потоков? "));
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
					console.log("worker killed");
					worker.kill();
				}
			}
		});

		cluster.on("exit", (worker) => {
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

init();

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

	const hosts = await yandex.getHosts();

	if (!hosts)
		return console.log("Не удалось получить данные о доменах на аккаунте");

	const browser = await puppeteer.launch({
		headless: false,
		slowMo: 20,
		ignoreHTTPSErrors: true,
		ignoreDefaultArgs: ["--enable-automation"],
	});

	const page = await browser.newPage();

	const yandexWeb = new YandexWeb(
		page,
		captcha,
		telegram,
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
	}

	if (!isLoginSuccess) return false;

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

	async function checkHost(host, url, loginName) {
		await page.goto(
			`https://webmaster.yandex.com/site/${host}/indexing/mirrors/`,
		);

		try {
			const element = await page.waitForSelector(
				".MirrorsContent-Suggest, .MirrorsActions-UnstickDisclaimer",
				{
					timeout: 4000,
					visible: true,
				},
			);

			const className = await page.evaluate((el) => el.className, element);

			if (/mirrorsactions\-unstickdisclaimer/i.test(className)) {
				const mainMirror = await yandex.getMainMirror(host);
				host = mainMirror.host_id;
				url = mainMirror.unicode_host_url;
				await checkHost(host, url, loginName);
			} else if (/mirrorscontent\-suggest/i.test(className)) {
				const notifcationText = await page.evaluate(() => {
					const text = document.querySelector(".MirrorsAlert-Content");
					if (text) {
						return text.textContent;
					} else {
						return "Без переезда";
					}
				});

				result.push([url, notifcationText]);
			} else {
				throw new Error("Информация о переезде не найдена");
			}
		} catch (err) {
			result.push([url, "Ошибка"]);
		}
	}

	// for (let i = 0; i < hosts.length; i++) {
	// 	let host = hosts[i].host_id;
	// 	let url = hosts[i].unicode_host_url;

	// 	//check function
	// 	await checkHost(host, url, loginName);
	// 	await page.waitForTimeout(1000);
	// 	console.log(
	// 		`${chalk.bold(thread_name)} Проверено сайтов: ${chalk.green.bold(
	// 			i + 1 + "/" + hosts.length,
	// 		)}`,
	// 	);
	// }

	// await google.sendData(result, loginName, url);

	// await browser.close();

	return true;
}
