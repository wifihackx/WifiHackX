const baseEnglish = {
  faqTitle: 'Frequently Asked Questions (FAQ)',
  backToMain: '← Back to main page',
  faqQ1: "What happens if I don't use a compatible WiFi adapter?",
  faqA1:
    'If you do not use a compatible WiFi adapter, the tool may fail to detect networks, fail to start monitor mode, show "interface not found" errors, disconnect, or break Evil Twin attacks. It is essential to use adapters with compatible chipsets (Atheros AR9271, Ralink RT3070, MediaTek MT7601, etc.) that support monitor mode and packet injection.',
  faqQ2: 'What is the most recommended chipset to avoid problems?',
  faqA2:
    'For maximum compatibility and to avoid problems, use a WiFi adapter with <b>Ralink RT3070</b> chipset. It is one of the most reliable and recognized in WiFi auditing, widely supported in Wifislax and other security distributions.<br><span class="professional-tip"><b>Professional tip:</b> If you want no hassle, always choose an RT3070 adapter.</span>',
  faqQ3: 'How many adapters do I need for captive portal attack?',
  faqA3:
    'To perform the <b>captive portal</b> attack stably and without errors, you must use <b>two WiFi adapters</b>.<br><span class="professional-tip">💡 <b>Professional tip:</b> To avoid compatibility issues and improve reliability, use <b>two adapters with Ralink RT3070 chipset</b>. This way, one can create the fake AP and the other can monitor and capture packets without interference.</span>',
  faqQ4: 'Which WiFi adapters are recommended?',
  faqA4:
    'Some widely compatible models:<br>TP-Link TL-WN722N v1 (Atheros AR9271), Alfa AWUS036NHA (Atheros AR9271), Alfa AWUS036NH (Ralink RT3070), Alfa AWUS036ACH (RTL8812AU), Panda PAU06 (RT5372), Comfast CF-912AC (RTL8812AU), among others.<br><b>Note:</b> Avoid new versions of some models (e.g., TP-Link TL-WN722N v2/v3) as they change the chipset and lose compatibility. Always check the chipset before buying.',
  faqQ5: 'Which operating system is guaranteed to work?',
  faqA5:
    'Cyclone Professional Evil Twin Attack Anonymous was designed and tested specifically on <b>Wifislax x64 4.0</b>. While it may work on other Linux distributions, full compatibility is only guaranteed on that environment. It is recommended to install it on Wifislax x64 4.0 for full functionality, since it is an XZM file native to Wifislax.',
  faqQ6: 'What should I do if I have problems?',
  faqA6:
    'First, check that your WiFi adapter or its chipset is on the recommended compatible adapters list. If your adapter is on the list and you still have problems, contact our support at <a href="mailto:__SUPPORT_EMAIL__">__SUPPORT_EMAIL__</a> and tell us your adapter model, operating system, and a screenshot of the error.',
  faqQ7: "Why doesn't the Evil Twin attack work properly?",
  faqA7:
    'Usually, this happens due to a WiFi adapter not compatible with AP or monitor mode, poorly installed drivers, or conflicts with other network programs. Always check compatibility and drivers.',
  faqQ8: 'What common errors appear if the adapter is not suitable?',
  faqA8:
    'Some common messages: "No compatible interface detected", "Monitor mode not supported", "Injection test failed", "Device busy or not found". If you see these errors, check your adapter\'s compatibility and consult the official documentation.'
};

const translations = {
  es: {
    faqTitle: 'Preguntas Frecuentes (FAQ)',
    backToMain: '← Volver a la página principal',
    faqQ1: '¿Qué ocurre si no uso un adaptador WiFi compatible?',
    faqA1:
      'Si no utilizas un adaptador WiFi compatible, la herramienta puede presentar problemas como no detectar redes, fallos al iniciar el modo monitor, errores de "interface not found", desconexiones o que el ataque Evil Twin no funcione correctamente. Es fundamental usar adaptadores con chipsets compatibles (Atheros AR9271, Ralink RT3070, MediaTek MT7601, etc.) que soporten modo monitor e inyección de paquetes.',
    faqQ2: '¿Cuál es el chipset más recomendado para evitar problemas?',
    faqA2:
      'Si quieres asegurarte la máxima compatibilidad y evitar problemas, utiliza un adaptador WiFi con chipset <b>Ralink RT3070</b>. Es uno de los más fiables y reconocidos en el mundo de la auditoría WiFi, ampliamente soportado en Wifislax y otras distribuciones de seguridad.<br><span class="professional-tip"><b>Recomendación profesional:</b> Si no quieres complicaciones, elige siempre un adaptador con RT3070.</span>',
    faqQ3: '¿Cuántos adaptadores necesito para el ataque de portal cautivo?',
    faqA3:
      'Para realizar el ataque de <b>portal cautivo</b> de forma estable y sin errores, es imprescindible utilizar <b>dos adaptadores WiFi</b>.<br><span class="professional-tip">💡 <b>Recomendación profesional:</b> Para evitar problemas de compatibilidad y asegurar el éxito del ataque, utiliza <b>dos adaptadores con chipset Ralink RT3070</b>. Así garantizas que uno cree el punto de acceso falso y el otro monitorice y capture paquetes sin interferencias.</span>',
    faqQ4: '¿Cuáles son los adaptadores WiFi compatibles recomendados?',
    faqA4:
      'Algunos modelos ampliamente compatibles:<br>TP-Link TL-WN722N v1 (Atheros AR9271), Alfa AWUS036NHA (Atheros AR9271), Alfa AWUS036NH (Ralink RT3070), Alfa AWUS036ACH (RTL8812AU), Panda PAU06 (RT5372), Comfast CF-912AC (RTL8812AU), entre otros.<br><b>Nota:</b> Evita versiones nuevas de algunos modelos (por ejemplo, TP-Link TL-WN722N v2/v3) ya que cambian el chipset y pierden compatibilidad. Siempre verifica el chipset antes de comprar.',
    faqQ5: '¿En qué sistema operativo se garantiza el funcionamiento?',
    faqA5:
      'Cyclone Professional Evil Twin Attack Anonymous ha sido diseñado y probado específicamente en <b>Wifislax x64 4.0</b>. Aunque puede funcionar en otras distribuciones Linux, solo se garantiza compatibilidad total en ese entorno. Se recomienda instalarlo en Wifislax x64 4.0 para asegurar el funcionamiento completo, ya que es un archivo XZM, formato nativo de Wifislax.',
    faqQ6: '¿Qué debo hacer si tengo problemas?',
    faqA6:
      'Primero, verifica que tu adaptador WiFi o el chipset que utiliza se encuentre en la lista de adaptadores compatibles recomendados. Si tu adaptador está en la lista y sigues teniendo problemas, contacta con nuestro soporte en <a href="mailto:__SUPPORT_EMAIL__">__SUPPORT_EMAIL__</a> e indícanos el modelo de tu adaptador, sistema operativo y una captura del error.',
    faqQ7: '¿Por qué el ataque Evil Twin no funciona correctamente?',
    faqA7:
      'Generalmente, esto ocurre por adaptador WiFi no compatible con modo AP o monitor, controladores mal instalados o conflictos con otros programas de red. Revisa siempre la compatibilidad y los drivers.',
    faqQ8: '¿Qué errores comunes aparecen si el adaptador no es adecuado?',
    faqA8:
      'Algunos mensajes frecuentes: "No se detectó ninguna interfaz compatible", "Monitor mode not supported", "Injection test failed", "Device busy or not found". Si ves estos errores, revisa la compatibilidad de tu adaptador y consulta la documentación oficial.'
  },
  en: baseEnglish,
  fr: {
    faqTitle: 'Questions fréquentes (FAQ)',
    backToMain: '← Retour à la page principale',
    faqQ1: 'Que se passe-t-il si je n’utilise pas un adaptateur WiFi compatible ?',
    faqA1: 'Sans adaptateur compatible, vous pouvez avoir des erreurs de mode moniteur, des déconnexions et des échecs sur Evil Twin. Utilisez des chipsets compatibles avec le mode moniteur et l’injection de paquets.',
    faqQ2: 'Quel chipset est le plus recommandé pour éviter les problèmes ?',
    faqA2: 'Le <b>Ralink RT3070</b> est fortement recommandé pour sa stabilité et sa compatibilité. <br><span class="professional-tip"><b>Conseil pro :</b> choisissez un RT3070 si vous voulez éviter les problèmes.</span>',
    faqQ3: 'Combien d’adaptateurs faut-il pour une attaque portail captif ?',
    faqA3: 'Pour une exécution stable, utilisez <b>deux adaptateurs WiFi</b>. <br><span class="professional-tip">💡 Un adaptateur crée le faux point d’accès et l’autre surveille/capture le trafic.</span>',
    faqQ4: 'Quels adaptateurs WiFi sont recommandés ?',
    faqA4: 'Exemples courants : TL-WN722N v1, Alfa AWUS036NHA, Alfa AWUS036NH, AWUS036ACH, Panda PAU06. Vérifiez toujours le chipset avant achat.',
    faqQ5: 'Quel système d’exploitation est garanti ?',
    faqA5: 'Le module a été conçu pour <b>Wifislax x64 4.0</b>. D’autres distributions peuvent fonctionner, mais la compatibilité totale est garantie sur cet environnement.',
    faqQ6: 'Que faire si j’ai des problèmes ?',
    faqA6: 'Vérifiez d’abord la compatibilité de votre adaptateur. Si le problème persiste, contactez <a href="mailto:__SUPPORT_EMAIL__">__SUPPORT_EMAIL__</a> avec votre modèle, système et capture d’écran.',
    faqQ7: 'Pourquoi l’attaque Evil Twin ne fonctionne pas correctement ?',
    faqA7: 'En général : adaptateur non compatible, pilotes incorrects ou conflits réseau. Vérifiez les modes AP et moniteur, ainsi que les pilotes.',
    faqQ8: 'Quelles erreurs apparaissent si l’adaptateur est inadapté ?',
    faqA8: 'Messages fréquents : "No compatible interface detected", "Monitor mode not supported", "Injection test failed", "Device busy or not found".'
  },
  it: {
    faqTitle: 'Domande frequenti (FAQ)',
    backToMain: '← Torna alla pagina principale',
    faqQ1: 'Cosa succede se non uso un adattatore WiFi compatibile?',
    faqA1: 'Con un adattatore non compatibile puoi avere errori in modalità monitor, disconnessioni e fallimenti dell’Evil Twin. Usa chipset compatibili con modalità monitor e iniezione di pacchetti.',
    faqQ2: 'Quale chipset è più consigliato per evitare problemi?',
    faqA2: 'Il <b>Ralink RT3070</b> è molto consigliato per stabilità e compatibilità. <br><span class="professional-tip"><b>Consiglio pro:</b> scegli RT3070 per evitare complicazioni.</span>',
    faqQ3: 'Quanti adattatori servono per l’attacco captive portal?',
    faqA3: 'Per operare in modo stabile servono <b>due adattatori WiFi</b>. <br><span class="professional-tip">💡 Uno crea il falso access point e l’altro monitora/cattura il traffico.</span>',
    faqQ4: 'Quali adattatori WiFi sono consigliati?',
    faqA4: 'Modelli comuni: TL-WN722N v1, Alfa AWUS036NHA, Alfa AWUS036NH, AWUS036ACH, Panda PAU06. Verifica sempre il chipset prima dell’acquisto.',
    faqQ5: 'Quale sistema operativo è garantito?',
    faqA5: 'Il modulo è stato progettato per <b>Wifislax x64 4.0</b>. Altre distribuzioni possono funzionare, ma la compatibilità totale è garantita in questo ambiente.',
    faqQ6: 'Cosa devo fare se ho problemi?',
    faqA6: 'Controlla prima la compatibilità dell’adattatore. Se il problema continua, scrivi a <a href="mailto:__SUPPORT_EMAIL__">__SUPPORT_EMAIL__</a> con modello, sistema operativo e screenshot.',
    faqQ7: 'Perché l’attacco Evil Twin non funziona bene?',
    faqA7: 'Di solito dipende da adattatore non compatibile, driver errati o conflitti di rete. Verifica modalità AP/monitor e driver.',
    faqQ8: 'Quali errori comuni compaiono con adattatore non adatto?',
    faqA8: 'Errori frequenti: "No compatible interface detected", "Monitor mode not supported", "Injection test failed", "Device busy or not found".'
  },
  de: {
    faqTitle: 'Häufig gestellte Fragen (FAQ)',
    backToMain: '← Zurück zur Hauptseite',
    faqQ1: 'Was passiert, wenn ich keinen kompatiblen WiFi-Adapter verwende?',
    faqA1: 'Mit einem inkompatiblen Adapter treten oft Monitor-Mode-Fehler, Verbindungsabbrüche und Probleme mit Evil Twin auf. Nutze einen Chipsatz mit Monitor-Modus und Paketinjektion.',
    faqQ2: 'Welcher Chipsatz wird am meisten empfohlen?',
    faqA2: 'Der <b>Ralink RT3070</b> gilt als sehr stabil und kompatibel. <br><span class="professional-tip"><b>Profi-Tipp:</b> Nimm RT3070, wenn du Probleme vermeiden willst.</span>',
    faqQ3: 'Wie viele Adapter brauche ich für Captive-Portal-Angriffe?',
    faqA3: 'Für stabile Ergebnisse brauchst du <b>zwei WiFi-Adapter</b>. <br><span class="professional-tip">💡 Einer erstellt den falschen Access Point, der andere überwacht und erfasst Pakete.</span>',
    faqQ4: 'Welche WiFi-Adapter sind empfehlenswert?',
    faqA4: 'Typische Modelle: TL-WN722N v1, Alfa AWUS036NHA, Alfa AWUS036NH, AWUS036ACH, Panda PAU06. Vor dem Kauf immer den Chipsatz prüfen.',
    faqQ5: 'Welches Betriebssystem ist garantiert unterstützt?',
    faqA5: 'Das Modul wurde für <b>Wifislax x64 4.0</b> entwickelt. Andere Distributionen können funktionieren, volle Kompatibilität ist dort jedoch nicht garantiert.',
    faqQ6: 'Was soll ich tun, wenn ich Probleme habe?',
    faqA6: 'Prüfe zuerst die Adapter-Kompatibilität. Wenn es weiter fehlschlägt, schreibe an <a href="mailto:__SUPPORT_EMAIL__">__SUPPORT_EMAIL__</a> mit Modell, OS und Screenshot.',
    faqQ7: 'Warum funktioniert der Evil-Twin-Angriff nicht korrekt?',
    faqA7: 'Häufige Ursachen sind inkompatible Adapter, fehlerhafte Treiber oder Netzwerk-Konflikte. Prüfe AP/Monitor-Modus und Treiber.',
    faqQ8: 'Welche typischen Fehler erscheinen bei ungeeignetem Adapter?',
    faqA8: 'Häufige Meldungen: "No compatible interface detected", "Monitor mode not supported", "Injection test failed", "Device busy or not found".'
  },
  pt: {
    faqTitle: 'Perguntas frequentes (FAQ)',
    backToMain: '← Voltar para a página principal',
    faqQ1: 'O que acontece se eu não usar um adaptador WiFi compatível?',
    faqA1: 'Sem adaptador compatível podem ocorrer erros no modo monitor, desconexões e falhas no Evil Twin. Use chipsets compatíveis com modo monitor e injeção de pacotes.',
    faqQ2: 'Qual chipset é mais recomendado para evitar problemas?',
    faqA2: 'O <b>Ralink RT3070</b> é muito recomendado por estabilidade e compatibilidade. <br><span class="professional-tip"><b>Dica profissional:</b> escolha RT3070 para evitar complicações.</span>',
    faqQ3: 'Quantos adaptadores preciso para ataque de portal cativo?',
    faqA3: 'Para operar com estabilidade você precisa de <b>dois adaptadores WiFi</b>. <br><span class="professional-tip">💡 Um cria o ponto de acesso falso e o outro monitora/captura o tráfego.</span>',
    faqQ4: 'Quais adaptadores WiFi são recomendados?',
    faqA4: 'Modelos comuns: TL-WN722N v1, Alfa AWUS036NHA, Alfa AWUS036NH, AWUS036ACH, Panda PAU06. Sempre confirme o chipset antes de comprar.',
    faqQ5: 'Qual sistema operacional tem funcionamento garantido?',
    faqA5: 'O módulo foi projetado para <b>Wifislax x64 4.0</b>. Outras distros podem funcionar, mas a compatibilidade total é garantida nesse ambiente.',
    faqQ6: 'O que devo fazer se eu tiver problemas?',
    faqA6: 'Primeiro verifique a compatibilidade do adaptador. Se continuar com erro, escreva para <a href="mailto:__SUPPORT_EMAIL__">__SUPPORT_EMAIL__</a> com modelo, sistema e captura.',
    faqQ7: 'Por que o ataque Evil Twin não funciona corretamente?',
    faqA7: 'As causas mais comuns são adaptador incompatível, drivers incorretos ou conflitos de rede. Verifique os modos AP/monitor e os drivers.',
    faqQ8: 'Quais erros comuns aparecem com adaptador inadequado?',
    faqA8: 'Erros comuns: "No compatible interface detected", "Monitor mode not supported", "Injection test failed", "Device busy or not found".'
  },
  ru: {
    faqTitle: 'Часто задаваемые вопросы (FAQ)',
    backToMain: '← Вернуться на главную',
    faqQ1: 'Что будет, если использовать несовместимый WiFi-адаптер?',
    faqA1: 'При несовместимом адаптере возможны ошибки monitor mode, обрывы и сбои Evil Twin. Используйте чипсеты с поддержкой monitor mode и packet injection.',
    faqQ2: 'Какой чипсет наиболее рекомендуется?',
    faqA2: '<b>Ralink RT3070</b> считается самым стабильным и совместимым. <br><span class="professional-tip"><b>Совет:</b> выбирайте RT3070, чтобы избежать проблем.</span>',
    faqQ3: 'Сколько адаптеров нужно для атаки captive portal?',
    faqA3: 'Для стабильной работы нужны <b>два WiFi-адаптера</b>. <br><span class="professional-tip">💡 Один поднимает фальшивую точку доступа, второй мониторит и перехватывает трафик.</span>',
    faqQ4: 'Какие адаптеры рекомендуются?',
    faqA4: 'Популярные модели: TL-WN722N v1, Alfa AWUS036NHA, Alfa AWUS036NH, AWUS036ACH, Panda PAU06. Перед покупкой проверяйте именно чипсет.',
    faqQ5: 'На какой ОС работа гарантирована?',
    faqA5: 'Модуль разрабатывался под <b>Wifislax x64 4.0</b>. На других Linux-дистрибутивах может работать, но полная совместимость гарантируется только там.',
    faqQ6: 'Что делать, если возникают проблемы?',
    faqA6: 'Сначала проверьте совместимость адаптера. Если проблема сохраняется, напишите на <a href="mailto:__SUPPORT_EMAIL__">__SUPPORT_EMAIL__</a> с моделью, ОС и скриншотом ошибки.',
    faqQ7: 'Почему Evil Twin работает некорректно?',
    faqA7: 'Чаще всего причина в несовместимом адаптере, драйверах или сетевых конфликтах. Проверьте режимы AP/monitor mode и драйверы.',
    faqQ8: 'Какие типичные ошибки при неподходящем адаптере?',
    faqA8: 'Частые ошибки: "No compatible interface detected", "Monitor mode not supported", "Injection test failed", "Device busy or not found".'
  },
  zh: {
    faqTitle: '常见问题（FAQ）',
    backToMain: '← 返回主页',
    faqQ1: '如果我不使用兼容的 WiFi 适配器会怎样？',
    faqA1: '使用不兼容适配器时，常见问题包括无法进入监听模式、断连以及 Evil Twin 失败。请使用支持监听模式和注入的芯片。',
    faqQ2: '最推荐的芯片组是什么？',
    faqA2: '<b>Ralink RT3070</b> 通常最稳定、兼容性最好。<br><span class="professional-tip"><b>专业建议：</b>想省心就优先选择 RT3070。</span>',
    faqQ3: '进行“Captive Portal”攻击需要几个适配器？',
    faqA3: '建议使用 <b>两个 WiFi 适配器</b>。<br><span class="professional-tip">💡 一个用于创建伪 AP，另一个用于监听和抓包，互不干扰。</span>',
    faqQ4: '推荐哪些 WiFi 适配器？',
    faqA4: '常见型号：TL-WN722N v1、Alfa AWUS036NHA、AWUS036NH、AWUS036ACH、Panda PAU06。购买前请确认芯片版本。',
    faqQ5: '在哪个系统上可以保证正常运行？',
    faqA5: '该模块主要针对 <b>Wifislax x64 4.0</b> 设计与测试。其他 Linux 发行版可能可用，但不保证完全兼容。',
    faqQ6: '如果出现问题我该怎么做？',
    faqA6: '先确认适配器兼容性。若仍有问题，请发送型号、系统与报错截图到 <a href="mailto:__SUPPORT_EMAIL__">__SUPPORT_EMAIL__</a>。',
    faqQ7: '为什么 Evil Twin 攻击不能正常工作？',
    faqA7: '常见原因是适配器不兼容、驱动异常或网络冲突。请检查 AP/监听模式和驱动。',
    faqQ8: '适配器不合适时会出现哪些常见错误？',
    faqA8: '常见报错： "No compatible interface detected"、"Monitor mode not supported"、"Injection test failed"、"Device busy or not found"。'
  },
  ja: {
    faqTitle: 'よくある質問（FAQ）',
    backToMain: '← メインページに戻る',
    faqQ1: '互換性のない WiFi アダプタを使うとどうなりますか？',
    faqA1: '互換性がない場合、モニターモード失敗、切断、Evil Twin 失敗などが発生します。モニターモードとパケット注入対応チップセットを使用してください。',
    faqQ2: '最も推奨されるチップセットは何ですか？',
    faqA2: '<b>Ralink RT3070</b> は安定性と互換性が高く推奨です。<br><span class="professional-tip"><b>プロのヒント：</b>迷ったら RT3070 を選んでください。</span>',
    faqQ3: 'キャプティブポータル攻撃にはアダプタが何本必要ですか？',
    faqA3: '安定動作には <b>2 本の WiFi アダプタ</b> が必要です。<br><span class="professional-tip">💡 1本で偽APを作成し、もう1本で監視・キャプチャを行います。</span>',
    faqQ4: '推奨される WiFi アダプタは？',
    faqA4: '代表例：TL-WN722N v1、Alfa AWUS036NHA、AWUS036NH、AWUS036ACH、Panda PAU06。購入前にチップセットを必ず確認してください。',
    faqQ5: 'どの OS で動作保証されますか？',
    faqA5: '本モジュールは <b>Wifislax x64 4.0</b> 向けに設計・検証されています。他の Linux でも動作する場合がありますが、完全互換は保証されません。',
    faqQ6: '問題が出た場合はどうすればいいですか？',
    faqA6: 'まずアダプタ互換性を確認してください。解決しない場合は、機種・OS・エラー画面を <a href="mailto:__SUPPORT_EMAIL__">__SUPPORT_EMAIL__</a> へ送ってください。',
    faqQ7: 'なぜ Evil Twin が正常に動作しないのですか？',
    faqA7: '主な原因はアダプタ非対応、ドライバ不備、ネットワーク競合です。AP/モニターモードとドライバを確認してください。',
    faqQ8: '不適切なアダプタで出る一般的なエラーは？',
    faqA8: '代表的なエラー： "No compatible interface detected"、"Monitor mode not supported"、"Injection test failed"、"Device busy or not found"。'
  },
  ko: {
    faqTitle: '자주 묻는 질문(FAQ)',
    backToMain: '← 메인 페이지로 돌아가기',
    faqQ1: '호환되지 않는 WiFi 어댑터를 사용하면 어떻게 되나요?',
    faqA1: '호환되지 않으면 모니터 모드 실패, 연결 끊김, Evil Twin 실패가 발생할 수 있습니다. 모니터 모드와 패킷 주입을 지원하는 칩셋을 사용하세요.',
    faqQ2: '문제를 줄이기 위한 가장 추천 칩셋은 무엇인가요?',
    faqA2: '<b>Ralink RT3070</b> 이 안정성과 호환성이 높아 가장 많이 추천됩니다. <br><span class="professional-tip"><b>전문가 팁:</b> 안정성을 원하면 RT3070을 선택하세요.</span>',
    faqQ3: '캡티브 포털 공격에는 어댑터가 몇 개 필요하나요?',
    faqA3: '안정적으로 수행하려면 <b>WiFi 어댑터 2개</b>가 필요합니다. <br><span class="professional-tip">💡 하나는 가짜 AP를 만들고, 다른 하나는 모니터링/캡처에 사용합니다.</span>',
    faqQ4: '추천되는 WiFi 어댑터는 무엇인가요?',
    faqA4: '대표 모델: TL-WN722N v1, Alfa AWUS036NHA, AWUS036NH, AWUS036ACH, Panda PAU06. 구매 전 칩셋을 반드시 확인하세요.',
    faqQ5: '어떤 운영체제에서 동작이 보장되나요?',
    faqA5: '이 모듈은 <b>Wifislax x64 4.0</b> 기준으로 설계/테스트되었습니다. 다른 Linux 배포판에서도 동작할 수 있으나 완전 호환은 보장되지 않습니다.',
    faqQ6: '문제가 생기면 어떻게 해야 하나요?',
    faqA6: '먼저 어댑터 호환성을 확인하세요. 계속 문제가 있으면 모델/OS/오류 화면을 <a href="mailto:__SUPPORT_EMAIL__">__SUPPORT_EMAIL__</a> 으로 보내주세요.',
    faqQ7: '왜 Evil Twin 공격이 정상적으로 동작하지 않나요?',
    faqA7: '주요 원인은 어댑터 비호환, 드라이버 문제, 네트워크 충돌입니다. AP/모니터 모드와 드라이버를 점검하세요.',
    faqQ8: '부적절한 어댑터에서 자주 발생하는 오류는 무엇인가요?',
    faqA8: '자주 보이는 오류: "No compatible interface detected", "Monitor mode not supported", "Injection test failed", "Device busy or not found".'
  }
};

const seoData = {
  es: {
    title: 'Preguntas Frecuentes (FAQ) - WifiHackX',
    description:
      'Resuelve tus dudas sobre compatibilidad, adaptadores y funcionamiento de WifiHackX. FAQ profesional multilingüe.',
    ogLocale: 'es_ES'
  },
  en: {
    title: 'Frequently Asked Questions (FAQ) - WifiHackX',
    description:
      'Answers about compatibility, adapters, and how WifiHackX works. Professional multilingual FAQ.',
    ogLocale: 'en_US'
  },
  de: {
    title: 'Häufig gestellte Fragen (FAQ) - WifiHackX',
    description:
      'Klärt Fragen zu Kompatibilität, Adaptern und Funktionsweise von WifiHackX. Professionelle mehrsprachige FAQ.',
    ogLocale: 'de_DE'
  },
  fr: {
    title: 'Questions fréquentes (FAQ) - WifiHackX',
    description:
      'Résolvez vos doutes sur la compatibilité, les adaptateurs et le fonctionnement de WifiHackX. FAQ professionnelle multilingue.',
    ogLocale: 'fr_FR'
  },
  it: {
    title: 'Domande frequenti (FAQ) - WifiHackX',
    description:
      'Risolve i dubbi su compatibilità, adattatori e funzionamento di WifiHackX. FAQ professionale multilingue.',
    ogLocale: 'it_IT'
  },
  pt: {
    title: 'Perguntas frequentes (FAQ) - WifiHackX',
    description:
      'Esclarece dúvidas sobre compatibilidade, adaptadores e funcionamento do WifiHackX. FAQ profissional multilíngue.',
    ogLocale: 'pt_PT'
  },
  ru: {
    title: 'Часто задаваемые вопросы (FAQ) - WifiHackX',
    description: 'Ответы на вопросы о совместимости, адаптерах и работе WifiHackX.',
    ogLocale: 'ru_RU'
  },
  zh: {
    title: '常见问题 (FAQ) - WifiHackX',
    description: '解答关于兼容性、适配器与 WifiHackX 运行方式的疑问。',
    ogLocale: 'zh_CN'
  },
  ja: {
    title: 'よくある質問 (FAQ) - WifiHackX',
    description: '互換性、アダプター、WifiHackX の動作に関する質問に回答します。',
    ogLocale: 'ja_JP'
  },
  ko: {
    title: '자주 묻는 질문 (FAQ) - WifiHackX',
    description: '호환성, 어댑터, WifiHackX 동작에 대한 질문에 답변합니다.',
    ogLocale: 'ko_KR'
  }
};

const getSupportEmail = () => {
  if (
    window.RuntimeConfigUtils &&
    typeof window.RuntimeConfigUtils.getSupportEmail === 'function'
  ) {
    const runtimeEmail = window.RuntimeConfigUtils.getSupportEmail('');
    if (typeof runtimeEmail === 'string' && runtimeEmail.trim()) {
      return runtimeEmail.trim();
    }
  }

  try {
    const orgJsonLd = document.getElementById('org-jsonld');
    if (orgJsonLd) {
      const payload = JSON.parse(orgJsonLd.textContent || '{}');
      const points = Array.isArray(payload.contactPoint) ? payload.contactPoint : [];
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (point && typeof point.email === 'string' && point.email.trim()) {
          return point.email.trim();
        }
      }
    }
  } catch (error_) {
    console.warn('Failed to read support email from organization JSON-LD', error_);
  }

  return 'support@wifihackx.com';
};

const patchSupportEmail = (value, supportEmail) => {
  if (typeof value !== 'string' || !value) {
    return value;
  }
  return value
    .replace(/mailto:__SUPPORT_EMAIL__/g, `mailto:${supportEmail}`)
    .replace(/__SUPPORT_EMAIL__/g, supportEmail);
};

const supportEmail = getSupportEmail();
Object.keys(translations).forEach(lang => {
  const dict = translations[lang];
  Object.keys(dict).forEach(key => {
    dict[key] = patchSupportEmail(dict[key], supportEmail);
  });
});

const storageKeys = ['selectedLanguage', 'wifiHackXLanguage', 'preferredLanguage'];
const appStateStorageKey = 'wifiHackX_state_i18n.currentLanguage';

const getStoredLanguage = () => {
  for (const key of storageKeys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return 'es';
};

const setStoredLanguage = lang => {
  storageKeys.forEach(key => localStorage.setItem(key, lang));
  localStorage.setItem(appStateStorageKey, JSON.stringify(lang));
};

let currentLang = getStoredLanguage();

const updateSEO = lang => {
  const data = seoData[lang] || seoData.es;
  const dynamicTitle = document.getElementById('dynamic-title');
  const metaDescription = document.getElementById('meta-description');
  const ogTitle = document.getElementById('og-title');
  const ogDescription = document.getElementById('og-description');
  const ogLocale = document.getElementById('og-locale');

  if (dynamicTitle) dynamicTitle.textContent = data.title;
  if (metaDescription) metaDescription.setAttribute('content', data.description);
  if (ogTitle) ogTitle.setAttribute('content', data.title);
  if (ogDescription) ogDescription.setAttribute('content', data.description);
  if (ogLocale) ogLocale.setAttribute('content', data.ogLocale);
};

const updateFAQJSONLD = lang => {
  const items = translations[lang] || translations.es;
  const qKeys = Object.keys(items).filter(key => key.startsWith('faqQ'));
  const aKeys = Object.keys(items).filter(key => key.startsWith('faqA'));
  if (!qKeys.length || !aKeys.length) return;

  const stripHtml = value => value.replace(/<[^>]*>/g, '');

  const faqs = qKeys.map((qk, index) => ({
    '@type': 'Question',
    name: stripHtml(items[qk] || ''),
    acceptedAnswer: {
      '@type': 'Answer',
      text: stripHtml(items[aKeys[index]] || '')
    }
  }));

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs
  };

  const faqJsonLd = document.getElementById('faq-jsonld');
  if (faqJsonLd) {
    faqJsonLd.textContent = JSON.stringify(jsonld, null, 2);
  }
};

const updateOrgJSONLD = () => {
  const orgJsonLd = document.getElementById('org-jsonld');
  if (!orgJsonLd) return;
  try {
    const payload = JSON.parse(orgJsonLd.textContent || '{}');
    const points = Array.isArray(payload.contactPoint) ? payload.contactPoint : [];
    points.forEach(point => {
      if (point && point['@type'] === 'ContactPoint') {
        point.email = supportEmail;
      }
    });
    orgJsonLd.textContent = JSON.stringify(payload, null, 2);
  } catch (error_) {
    console.warn('Failed to update organization JSON-LD support email', error_);
  }
};

const setLanguage = lang => {
  if (!translations[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  setStoredLanguage(lang);

  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.dataset.translate;
    const translation = translations[currentLang]?.[key] || translations.es[key];
    if (translation) {
      el.innerHTML = translation;
    }
  });

  document.querySelectorAll('#headerLangSelect .lang-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.lang === lang);
  });

  updateSEO(lang);
  updateFAQJSONLD(lang);
};

const syncLanguageFromStorage = reason => {
  const storedLang = getStoredLanguage();
  if (storedLang && storedLang !== currentLang) {
    setLanguage(storedLang);
  } else if (!currentLang && storedLang) {
    setLanguage(storedLang);
  }
};

const initLanguageSelector = () => {
  const container = document.getElementById('headerLangSelect');
  if (!container) return;

  container.querySelectorAll('.lang-chip').forEach(chip => {
    chip.addEventListener('click', () => setLanguage(chip.dataset.lang));
  });

  window.addEventListener('storage', event => {
    if (storageKeys.includes(event.key)) {
      setLanguage(event.newValue || 'es');
    }
  });
};

const initAccordion = () => {
  const faqItems = document.querySelectorAll('.faq-item');

  const openItem = (item, wrapper) => {
    const naturalHeight = wrapper.scrollHeight;
    wrapper.style.maxHeight = `${naturalHeight}px`;
    const onTransitionEnd = () => {
      if (item.classList.contains('active')) {
        wrapper.style.maxHeight = 'none';
      }
      wrapper.removeEventListener('transitionend', onTransitionEnd);
    };
    wrapper.addEventListener('transitionend', onTransitionEnd);
  };

  const closeItem = wrapper => {
    if (wrapper.style.maxHeight === 'none') {
      wrapper.style.maxHeight = `${wrapper.scrollHeight}px`;
      requestAnimationFrame(() => {
        wrapper.style.maxHeight = '0px';
      });
      return;
    }
    wrapper.style.maxHeight = '0px';
  };

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answerWrapper = item.querySelector('.faq-answer-wrapper');

    question.addEventListener('click', () => {
      const isExpanded = question.getAttribute('aria-expanded') === 'true';
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          otherItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
          closeItem(otherItem.querySelector('.faq-answer-wrapper'));
        }
      });

      item.classList.toggle('active');
      question.setAttribute('aria-expanded', (!isExpanded).toString());
      if (!isExpanded) {
        openItem(item, answerWrapper);
      } else {
        closeItem(answerWrapper);
      }
    });
  });

  window.addEventListener('resize', () => {
    faqItems.forEach(item => {
      if (item.classList.contains('active')) {
        const wrapper = item.querySelector('.faq-answer-wrapper');
        if (wrapper.style.maxHeight === 'none') {
          wrapper.style.maxHeight = `${wrapper.scrollHeight}px`;
          requestAnimationFrame(() => {
            if (item.classList.contains('active')) {
              wrapper.style.maxHeight = 'none';
            }
          });
          return;
        }
        wrapper.style.maxHeight = `${wrapper.scrollHeight}px`;
      }
    });
  });
};

document.addEventListener('DOMContentLoaded', () => {
  initAccordion();
  initLanguageSelector();
  setLanguage(currentLang);
  updateOrgJSONLD();

  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      syncLanguageFromStorage('pageshow');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncLanguageFromStorage('visibilitychange');
    }
  });
});

