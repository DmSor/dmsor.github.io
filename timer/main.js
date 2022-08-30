
(function main() {

  const SEC_MS = 1000;
  const MIN_MS = SEC_MS * 60;
  const WORK_TIME_MS = MIN_MS * 30;


  const LS_BOT_TOKEN = "timer-botToken";
  const LS_CHAT_ID = "timer-chatId";
  const LS_LAST_START_MS = "timer-lastStartMs";

  const TG_API = "https://api.telegram.org/bot";

  const botNotification = (function BotNotificationFactory() {
    let botToken = localStorage.getItem(LS_BOT_TOKEN) || null;
    let chatId = localStorage.getItem(LS_CHAT_ID) || null;
    let lastStartDate = null;
    {
      let lastStartMs = localStorage.getItem(LS_LAST_START_MS);
      if (lastStartMs) {
        lastStartMs = Number.parseInt(lastStartMs);
      }
      if (Number.isFinite(lastStartMs)) {
        lastStartDate = new Date(lastStartMs) || null;
      }
    }
    return {
      setBotToken(nextBotToken) {
        botToken = nextBotToken;
        if (botToken) {
          localStorage.setItem(LS_BOT_TOKEN, botToken);
        } else {
          localStorage.removeItem(LS_BOT_TOKEN);
        }
      },
      setChatId(nextChatId) {
        chatId = nextChatId;
        if (chatId) {
          localStorage.setItem(LS_CHAT_ID, chatId);
        } else {
          localStorage.removeItem(LS_CHAT_ID);
        }
      },
      getLastStartDate() {
        return lastStartDate;
      },
      sendNotification(startDate) {
        if (!botToken || !chatId) return;
        if (lastStartDate != null && lastStartDate.getTime() === startDate.getTime()) return;
        lastStartDate = startDate;
        localStorage.setItem(LS_LAST_START_MS, `${startDate.getTime()}`);
        send();
      },
      hasBotToken() {
        return !!botToken;
      },
      getChatId() {
        return chatId;
      },
      logUpdates() {
        if (!botToken) {
          console.log("Need bot token");
          return;
        }
        const config = {
          botToken,
        };
        console.log("Loading...");
        fetch(`${TG_API}${encodeURIComponent(config.botToken)}/getUpdates`)
          .then(rsp => {
            if (rsp.status !== 200) throw new Error(`Wrong status: ${rsp.status}`);
            return rsp.json();
          })
          .then(data => {
            console.log(data);
          })
          .catch(err => {
            console.error(err);
          });
      },
    };

    function send() {
      const config = {
        botToken,
        chatId,
        lastStartDate,
      };
      fetch(`${TG_API}${encodeURIComponent(config.botToken)}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: `Expired from ${config.lastStartDate.toString()}`,
        }),
      })
        .then(rsp => {
          if (rsp.status !== 200) throw new Error(`Wrong status: ${rsp.status}`);
          return rsp.json();
        })
        .then(data => {
          console.log(data);
        })
        .catch(err => {
          console.error(err);
        });
    }

  }());

  {
    const appRootElement = document.createElement("div");
    appRootElement.classList.add("app-root");
    document.body.appendChild(appRootElement);
    const appRoot = ReactDOM.createRoot(appRootElement);
    appRoot.render(React.createElement(AppRoot));
  }

  function useNow() {
    const [
      nowDate,
      setNowDate,
    ] = React.useState(new Date());
    React.useEffect(() => {
      const intervalId = setInterval(() => {
        setNowDate(new Date());
      }, 1000);
      return () => {
        clearInterval(intervalId);
      };
    }, [
      setNowDate,
    ]);
    return nowDate;
  }

  const TimerStateType = {
    Sleep: "Sleep",
    Work: "Work",
  };

  function makeUseTimerState(lsPrefix) {
    const LS_STATE = `${lsPrefix}state`;
    return useTimerState;
    function useTimerState() {
      const initState = React.useMemo(() => {
        let lsStr = localStorage.getItem(LS_STATE);
        if (lsStr) {
          const lsObj = JSON.parse(lsStr);
          if (lsObj.startDate) {
            lsObj.startDate = new Date(lsObj.startDate);
          }
          return lsObj;
        } else {
          return {
            type: TimerStateType.Sleep,
          };
        }
      }, []);

      const [state, setState] = React.useState(initState);

      const setStateAndSave = React.useCallback(nextState => {
        setState(nextState);
        localStorage.setItem(LS_STATE, JSON.stringify(nextState));
      }, [
        setState,
      ])

      const timerState = React.useMemo(() => {
        switch (state.type) {
          case TimerStateType.Sleep:
            return {
              type: state.type,
              start() {
                toWorkFromNow();
              },
            };
          case TimerStateType.Work:
            return {
              type: state.type,
              startDate: state.startDate,
              stop() {
                toSleep();
              },
              restart() {
                toWorkFromNow();
              },
            };
          default:
            throw new Error(`Unknown TimerStateType: ${timerStateType}`);
        }

        function toSleep() {
          setStateAndSave({
            type: TimerStateType.Sleep,
          });
        }

        function toWorkFromNow() {
          setStateAndSave({
            type: TimerStateType.Work,
            startDate: new Date(),
          });
        }

      }, [
        state,
        setStateAndSave,
      ]);

      return timerState;

    }
  }

  function StdBtn({
    onClick,
    text,
  }) {
    return React.createElement(
      "button",
      {
        type: "button",
        onClick,
      },
      text,
    );
  }

  function BotSettings() {

    const [, setVersion] = React.useState({});

    const tokenRef = React.useRef(null);

    const chatIdRef = React.useRef(null);

    const [token, setToken] = React.useState("");

    const nextVersion = React.useCallback(() => {
      setVersion({});
    }, [
      setVersion,
    ]);

    const fromInputToToken = React.useCallback(() => {
      if (!tokenRef.current) return;
      setToken(tokenRef.current.value);
    }, [
      setToken,
      tokenRef,
    ]);

    const syncToken = React.useCallback(() => {
      botNotification.setBotToken(token);
      nextVersion();
      setToken("");
    }, [
      token,
      nextVersion,
    ]);

    const syncChatId = React.useCallback(() => {
      if (!chatIdRef.current) return;
      botNotification.setChatId(chatIdRef.current.value);
      nextVersion();
    }, [
      chatIdRef,
      nextVersion,
    ]);

    const logUpdates = React.useCallback(() => {
      botNotification.logUpdates();
    }, []);


    return React.createElement(
      "div",
      {
        className: "bot-settings",
      },
      React.createElement(
        "label",
        null,
        `Token ${botNotification.hasBotToken() ? "[Exists]" : "[Empty]"}: `,
        React.createElement(
          "input",
          {
            ref: tokenRef,
            type: "password",
            value: token,
            onChange: fromInputToToken,
          }
        ),
      ),
      React.createElement(
        StdBtn,
        {
          text: "Set",
          onClick: syncToken,
        }
      ),
      React.createElement("br"),
      React.createElement(
        "label",
        null,
        `Chat: `,
        React.createElement(
          "input",
          {
            ref: chatIdRef,
            type: "text",
            value: botNotification.getChatId() || "",
            onChange: syncChatId,
          }
        ),
      ),
      React.createElement("br"),
      React.createElement(
        StdBtn,
        {
          text: "Log updates",
          onClick: logUpdates,
        },
      )
    );
  }

  function SleepState({
    start,
  }) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "h2",
        null,
        "Sleep",
      ),
      React.createElement(
        StdBtn,
        {
          onClick: start,
          text: "Start",
        },
      ),
    );
  }

  function useMsToTimeStr(ms) {
    const timeStr = React.useMemo(() => {
      if (ms < MIN_MS) {
        return `${(ms / SEC_MS).toFixed(0)} sec`;
      } else {
        return `${(ms / MIN_MS).toFixed(2)} min`;
      }
    }, [
      ms,
    ]);
    return timeStr;
  }


  function WorkState({
    nowDate,
    startDate,
    stop,
    restart,
  }) {
    const workMs = nowDate.getTime() - startDate.getTime();
    const workTimeStr = useMsToTimeStr(workMs);
    const expired = workMs > WORK_TIME_MS;
    if (expired) {
      botNotification.sendNotification(startDate);
    }
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "h2",
        {
          style: {
            color: expired ? "red" : null,
          },
        },
        `Work ${workTimeStr}`,
      ),
      React.createElement(
        StdBtn,
        {
          onClick: stop,
          text: "Stop",
        },
      ),
      React.createElement(
        StdBtn,
        {
          onClick: restart,
          text: "Restart",
        },
      ),
    );
  }

  function AppState() {
    const useTimerState = React.useMemo(() => makeUseTimerState("timer-"), []);
    const nowDate = useNow();
    const timerState = useTimerState();

    switch (timerState.type) {
      case TimerStateType.Sleep:
        return React.createElement(
          SleepState,
          {
            start: timerState.start,
          },
        )
      case TimerStateType.Work:
        return React.createElement(
          WorkState,
          {
            nowDate,
            startDate: timerState.startDate,
            stop: timerState.stop,
            restart: timerState.restart,
          },
        );
      default:
        throw new Error(`Unknown TimerStateType: ${timerState.type}`);
    }
  }

  function AppRoot() {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        BotSettings,
      ),
      React.createElement(
        AppState,
      ),
    )
  }



}());
