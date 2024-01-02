import { Action, ActionPanel, LaunchProps, List, getPreferenceValues, clearSearchBar, Icon, LocalStorage, openExtensionPreferences, closeMainWindow, PopToRootType, showToast, Toast } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import bringApi from "bring-shopping";
import { useEffect, useRef, useState } from "react";

const preferences = getPreferenceValues();

const bring = new bringApi({
  mail: preferences.email,
  password: preferences.password,
});

interface List {
  listUuid: string;
  name: string;
}

interface Item {
  name: string;
  specification: string;
}


export default function Command(props: LaunchProps) {

  /* * * * * *
  * 
  *   Initialize App
  * 
  * 1. fetch listUuid from storage
  * 2. fetch all lists
  * 3. check, if listUuid from storage is not empty
  *  3.1. if empty, set listUuid to first list in lists
  *  3.2. if not empty, set listUuid to listUuid from storage
  * 4. fetch items of selected list
  * 
  * * * * * */

  const loginStatus = useRef("empty"); // success, error, loading, empty

  const [loginStatusObject, setLoginStatusObject] = useState({
    errorCode: 0,
    errorMessage: "",
  });

  const bringLogin = async () => {

    try {
      await bring.login().then(() => {
        console.log("login success");
      });

      loginStatus.current = "success";
    } catch (e) {

      // when error is 400, login failed
      const errorMessage = e.toString();

      console.log("errorMessage: " + errorMessage);


      if (errorMessage.includes("400") || errorMessage.includes("401")) {
        setLoginStatusObject({
          errorCode: 400,
          errorMessage: "Invalid Mail or Password. Please check your login data.",
        });
      } else if (errorMessage.includes("Cannot Login: Error: getaddrinfo ENOTFOUND api.getbring.com")) {
        setLoginStatusObject({
          errorCode: 0,
          errorMessage: "Check your internet connection.",
        });
      } else {
        setLoginStatusObject({
          errorCode: 0,
          errorMessage: e.toString(),
        });
      }

      showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: "login failed",
      })

      loginStatus.current = "error";
    }
  }

  // array of all lists
  const [currentList, setCurrentList] = useState("");
  const [allLists, setAllLists] = useState<Array<object>>([]);
  const { items: userGivenItems } = props.arguments;


  // initialize idle state
  const init = async () => {
    console.log("init");
    setIsLoading(true);

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "updating ...",
    })

    // login to Bring!
    await bringLogin();

    // when login failed, show error
    if (loginStatus.current === "error") {
      console.error("login failed");
      setIsLoading(false);
      return;
    }

    // fetch listUuid from storage
    const listUuidFromStore = await LocalStorage.getItem("shoppingListName");
    const ListsFromAPI = await fetchLists().then(({ lists }) => {
      return lists;
    });
    setAllLists(ListsFromAPI);
    let tempCurrentList = "";

    if (listUuidFromStore) {

      const storedUuidIsValid = ListsFromAPI.find((list) => list.listUuid === listUuidFromStore);
      if (storedUuidIsValid) {
        tempCurrentList = listUuidFromStore.toString();
      } else {
        const firstList = ListsFromAPI[0].listUuid.toString();
        tempCurrentList = firstList;
      }
    }

    // select list
    selectList(tempCurrentList)

    // fetch items of selected list
    console.log("currentList: " + tempCurrentList);
    console.log(userGivenItems);

    addItemsToList(userGivenItems, tempCurrentList);

    // remove loading indicator
    toast.hide();
  }

  useEffect(() => {
    init();
  }, []);


  /* * * * * *
  * 
  *   Data Handling
  * 
  * * * * * */

  // fetch all lists
  const fetchLists = async () => {
    console.log("fetch lists");
    // await bringLogin();
    const fetchedLists = await bring.loadLists();
    console.log("lists fetched");
    return fetchedLists;
  }

  // select list
  const selectList = async (list: string) => {
    console.log("select list");
    await setCurrentList(list);
    await fetchItemsOnList(list);
    await LocalStorage.setItem("shoppingListName", list);
    console.log("list selected");
  }

  // items on selected list
  const [itemList, setItemList] = useState({ purchase: {}, recently: {} });

  // fetch items of selected list
  const fetchItemsOnList = async (list: string = currentList) => {
    console.log("fetch items on list");
    // await bringLogin();
    const tempItemList = await bring.getItems(list); // get shopping list
    setItemList(tempItemList); // update shopping list
    console.log(tempItemList);

    console.log("items on list fetched");
    setIsLoading(false);
  }

  // add item to selected list (item is a string of comma separated items) (list is a string of listUuid, if empty, use currentList)
  const addItemsToList = async (items: string, list: string = currentList) => {
    if (!items) return fetchItemsOnList(list);

    console.log("add items to list");

    const itemNames = items.split(/,/).map((item) => item.trim());

    for (const itemName of itemNames.slice(0, 10)) {
      await bring.saveItem(list, itemName, "");
    }

    showToast({
      style: Toast.Style.Success,
      title: "added:",
      message: itemNames.slice(0, 10).join(", "),
    })

    await fetchItemsOnList(list);
  }


  // remove item from selected list
  const removeItemFromList = async (items: string, list: string = currentList) => {
    console.log("remove item from list");
    // await bringLogin();
    await bring.moveToRecentList(list, items);
    await fetchItemsOnList(list);

    showToast({
      style: Toast.Style.Success,
      title: "removed:",
      message: items,
    })
  }







  // // // // // // // // // /
  // raycast UI and storage //
  // // // // // // // // // /

  // loading indicator
  const [isLoading, setIsLoading] = useState(true);

  // form input
  const [uiSearchTerm, setUiSearchTerm] = useState("");
  const [uiSelectedItem, setUiSelectedItem] = useState("");

  useEffect(() => {
    console.log("uiSelectedItem: " + uiSelectedItem);

  }, [uiSelectedItem]);

  const uiAddSearchTermToList = async (tempSearchTerm: string = uiSearchTerm, listUuid: string = currentList) => {

    console.log("tempSearchTerm", tempSearchTerm);
    console.log("listUuid", listUuid);



    setIsLoading(true);
    clearSearchBar();

    await addItemsToList(tempSearchTerm, listUuid);
    await fetchItemsOnList(listUuid);
  }

  const uiAddSelectedItemToList = async (tempSelectedItem: string = uiSelectedItem, listUuid: string = currentList) => {
    setIsLoading(true);

    await addItemsToList(tempSelectedItem, listUuid);
  }

  const uiRemoveSelectedItemFromList = async (tempSelectedItem: string = uiSelectedItem, listUuid: string = currentList) => {
    setIsLoading(true);

    await removeItemFromList(tempSelectedItem, listUuid);
  }

  const uiSelectList = async (tempListUuid: string = currentList) => {
    setIsLoading(true);

    await selectList(tempListUuid);
  }


  const uiOpenBring = async () => {
    // find out position of currentList in allLists
    const listIndex = allLists.findIndex((list: List) => list.listUuid === currentList);
    const url = "https://web.getbring.com/app/lists/" + listIndex + "/";

    await runAppleScript(`
      open location "${url}"
    `);
  };


  // error handling

  const uiGoToPreferences = async () => {
    await closeMainWindow({ popToRootType: PopToRootType.Immediate });
    openExtensionPreferences();
  }


  return (
    <>
      {loginStatus.current === "error" ?
        // Error Handling
        <List
          filtering={false}
          searchBarPlaceholder={"Search and add items ..." + loginStatus.current}
          isShowingDetail
        >

          <List.Item
            title="Change Login Data"
            icon={Icon.Cog}
            detail={
              <List.Item.Detail
                markdown={loginStatusObject.errorMessage ? "## " + loginStatusObject.errorMessage + " " : "## Error ...;"}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title={`email: ${preferences.email}`} />
                    <List.Item.Detail.Metadata.Separator />
                    <List.Item.Detail.Metadata.Label title={`password: ${"•".repeat(preferences.password.length)}`} />
                    <List.Item.Detail.Metadata.Separator />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <Action
                  title="Open Preferences"
                  onAction={uiGoToPreferences}
                />
              </ActionPanel>
            }
          />
        </List>
        :
        // Main UI
        <List
          isLoading={isLoading}
          searchBarPlaceholder={"Search and add items ..."}
          filtering={true}
          onSearchTextChange={setUiSearchTerm}
          onSelectionChange={(tempSelectedItem) => {
            setUiSelectedItem(String(tempSelectedItem));
          }}
          searchBarAccessory={
            // Dropdown to select Shopping List
            <List.Dropdown
              tooltip="Show availability in a different country"
              onChange={uiSelectList}
              defaultValue={currentList}
            >
              {allLists.map((singleList: List) => (
                <List.Dropdown.Item
                  key={singleList.listUuid}
                  title={singleList.name}
                  value={singleList.listUuid}
                />
              ))}
            </List.Dropdown>
          }
        >
          <List.Section title="On shopping List">
            {itemList
              && itemList.purchase
              && Object.values(itemList.purchase).map((item: Item) => (
                <List.Item
                  key={item.name}
                  title={uiSelectedItem == item.name ? "" + item.name : item.name}
                  subtitle={item.specification}
                  icon={uiSelectedItem == item.name ? Icon.CheckCircle : Icon.Circle}
                  id={item.name}
                  detail={item.specification}
                  actions={
                    <ActionPanel>
                      <Action
                        title={`remove "${item.name}"`}
                        onAction={() => { uiRemoveSelectedItemFromList(item.name) }}
                        icon={Icon.Trash}
                      />
                      <Action
                        title={`open List in browser`}
                        onAction={uiOpenBring}
                        icon={Icon.Globe}
                      />
                    </ActionPanel>
                  }
                />
              ))}
          </List.Section>
          {uiSearchTerm &&
            <List.Item
              key={"add"}
              title={"add " + uiSearchTerm}
              icon={Icon.Plus}
              actions={
                <ActionPanel>
                  <Action
                    title={"add " + uiSearchTerm}
                    onAction={() => { uiAddSearchTermToList() }}
                  />
                </ActionPanel>
              }
            />
          }

          {preferences.showRecent &&
            <List.Section title="Recently bought">
              {itemList
                && itemList.recently
                && Object.values(itemList.recently).map((item: Item) => (
                  <List.Item
                    key={item.name}
                    title={uiSelectedItem == item.name ? item.name : item.name}
                    icon={uiSelectedItem == item.name ? Icon.Plus : Icon.Plus}
                    id={item.name}
                    actions={
                      <ActionPanel>
                        <Action
                          title={`Add "${item.name}"`}
                          onAction={() => { uiAddSelectedItemToList(item.name) }}
                          icon={Icon.Trash}
                        />
                      </ActionPanel>
                    }
                  />
                ))}
            </List.Section>
          }
        </List>
      }
    </>
  );
}
