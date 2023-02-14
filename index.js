const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const prompt = require("prompt-sync")();

// const threads = prompt("Количество потоков? ");

//Мои модули
const { Session } = require("./modules/session");
const { GoogleSheet } = require("./modules/googleSheet");
const { getHosts } = require("./modules/getHosts");

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

async function wrap(data) {
	let counter = 0;

	const { token, login, pass, answer, url } = data[counter];

	const loginName = login.match(/\w+(?=@)/)[0];

	const sessionFolder = `${__dirname}/profiles/${loginName}`;

	if (!fs.existsSync(sessionFolder)) {
		fs.mkdirSync(sessionFolder);
	}

	await main(sessionFolder, token, login, pass, answer, url);

	//задачи функции управлять потоками
	//передавать данные в функцию мейн
}

wrap(data);

async function main(sessionFolder, token, login, pass, answer, url) {
	const google = new GoogleSheet();
	const hosts = await getHosts(token);

	if (!hosts)
		return console.log("Не удалось получить данные о доменах на аккаунте");

	//host_id это юрл который подставляем при проверке статуса переезда
	//unicode_host_url это юрл в стандартном виде

	const browser = await puppeteer.launch({
		headless: false,
		slowMo: 20,
		ignoreHTTPSErrors: true,
		ignoreDefaultArgs: ["--enable-automation"],
	});

	const page = await browser.newPage();

	page.setDefaultTimeout(20000);

	const session = new Session(page, sessionFolder);

	await page.goto(
		"https://passport.yandex.com/auth?mode=auth&retpath=https%3A%2F%2Fwebmaster.yandex.com%2Fsites%2F",
	);

	if (fs.existsSync(`${sessionFolder}/cookies.json`)) {
		await session
			.loadSession()
			.then(() => {
				console.log("Загрузили профиль");
			})
			.catch((err) => {
				console.log(err);
				console.log("Ошибка загрузки профиля");
			});
	}

	await page.reload();

	let isLoginFieldExist = false;

	await page.click('[data-type="login"]');

	try {
		isLoginFieldExist = await page.waitForSelector("#passp-field-login", {
			timeout: 8000,
		});
	} catch {}

	//если переменная true тогда нужно выполнить логин
	if (isLoginFieldExist) {
		try {
			await page.click("[data-id='button-all']", { timeout: 4000 });
		} catch {}

		await page.type("#passp-field-login", login);

		await page.click(".passp-sign-in-button button");

		await page.waitForSelector("[name='passwd']");

		await page.type("[name='passwd']", pass);

		await page.click(".passp-sign-in-button button");

		try {
			await page.waitForSelector("[name='captcha_answer']", { timeout: 5000 });
			console.log("Капча найдена");
			await page.waitForTimeout(20000);
		} catch {
			console.log("Капча не найдена");
		}

		let questionField;

		try {
			questionField = await page.waitForSelector("#passp-field-question", {
				timeout: 5000,
			});
		} catch {}

		if (questionField) {
			await questionField.type(answer);
			await page.waitForTimeout(1000);
			await page.click(".Button2_type_submit");
		}

		await page.waitForTimeout(5000);

		session
			.saveSession()
			.then(() => {
				console.log("Профиль сохранен");
			})
			.catch((err) => {
				console.log(err);
				console.log("Не удалось сохранить профиль");
			});
	}

	let selectAccount;

	try {
		selectAccount = await page.waitForSelector(
			"a[href='https://webmaster.yandex.com/sites/']",
			{ timeout: 5000 },
		);
	} catch {}

	if (selectAccount) {
		await selectAccount.click();
	}

	try {
		await page.waitForSelector(".UserID-Account", { timeout: 5000 });
	} catch (err) {
		console.log(err);
	}

	console.log("Выполнен вход в аккаунт Яндекс Вебмастер");

	//здесь уже начинается проверка

	let result = [];

	for (let i = 0; i < hosts.length; i++) {
		let host = hosts[i].host_id;
		let url = hosts[i].unicode_host_url;

		console.log("Всего сайтов:", hosts.length);
		console.log("Счетчик:", i + 1);
		console.log("Текущий хост:", host);
		if (host) {
			await page.goto(
				`https://webmaster.yandex.com/site/${host}/indexing/mirrors/`,
			);

			try {
				await page.waitForSelector(".MirrorsContent-Suggest", {
					timeout: 5000,
				});
				const notifcationText = await page.evaluate(() => {
					const text = document.querySelector(".MirrorsAlert-Content");
					if (text) {
						return text.textContent;
					} else {
						return "Без переезда";
					}
				});

				result.push([url, notifcationText]);

				await page.waitForTimeout(1000);
			} catch (err) {
				result.push([url, "Ошибка"]);
				console.log(err);
			}
		}
	}

	console.log(result);
	const response = await google.sendData(result, url);
	console.log(response);
	await browser.close();
	return console.log("Проверка завершена");
}
