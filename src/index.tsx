import { Action, ActionPanel, LaunchProps, List, getPreferenceValues, clearSearchBar, Icon, LocalStorage } from "@raycast/api";
import bringApi from "bring-shopping";
import { useEffect, useRef, useState } from "react";


const preferences = getPreferenceValues();

const bring = new bringApi({
  mail: preferences.email,
  password: preferences.password,
});


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

  const bringLogin = async () => {
    // console.log("bringLogin");
    try {
      await bring.login();
    } catch (e: any) {
      console.error(`Error on Login: ${e.message}`);
    }
  }

  // array of all lists
  let [currentList, setCurrentList] = useState("");
  let [allLists, setAllLists] = useState<Array<object>>([]);
  const { items: userGivenItems } = props.arguments;




  // initialize idle state
  const init = async () => {
    console.log("init");

    // login to Bring!
    await bringLogin();

    // fetch listUuid from storage
    let listUuidFromStore = await LocalStorage.getItem("shoppingListName");
    let ListsFromAPI = await fetchLists().then(({ lists }) => {
      return lists;
    });
    setAllLists(ListsFromAPI);
    let tempCurrentList = "";

    if (listUuidFromStore) {

      let storedUuidIsValid = ListsFromAPI.find((list: any) => list.listUuid === listUuidFromStore);
      if (storedUuidIsValid) {
        tempCurrentList = listUuidFromStore.toString();
      } else {
        let firstList = ListsFromAPI[0].listUuid.toString();
        tempCurrentList = firstList;
      }
    }

    // select list
    selectList(tempCurrentList)

    // fetch items of selected list
    console.log("currentList: " + tempCurrentList);
    console.log(userGivenItems);

    addItemsToList(userGivenItems, tempCurrentList);

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
    await bringLogin();
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
    await bringLogin();
    const tempItemList = await bring.getItems(list); // get shopping list
    setItemList(tempItemList); // update shopping list
    console.log(tempItemList);

    console.log("items on list fetched");
  }

  // add item to selected list (item is a string of comma separated items) (list is a string of listUuid, if empty, use currentList)
  const addItemsToList = async (items: string, list: string = currentList) => {
    if (!items) return fetchItemsOnList(list);

    console.log("add items to list");
    await bringLogin();
    for (let itemName of items.split(",")) {
      await bring.saveItem(list, itemName, "");
    }
    await fetchItemsOnList(list);
  }


  // remove item from selected list
  const removeItemFromList = async (items: string, list: string = currentList) => {
    console.log("remove item from list");
    await bringLogin();
    await bring.removeItem(list, items);
    await fetchItemsOnList(list);
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

  const uiAddInputToList = async (input: string, listUuid: string = currentList) => {
    await bringLogin();
    await addItemsToList(input, listUuid);
    await fetchItemsOnList(listUuid);
  }

  const uiAddSearchTermToList = async (tempSearchTerm: string = uiSearchTerm, listUuid: string = currentList) => {
    await uiAddInputToList(uiSearchTerm, listUuid);
    clearSearchBar();
  }

  const uiAddSelectedItemToList = async (tempSelectedItem: string = uiSelectedItem, listUuid: string = currentList) => {
    await addItemsToList(tempSelectedItem, listUuid);
  }

  return (
    // whole List UI
    <List
      // isLoading={isLoading}
      searchBarPlaceholder="Search and add items ..."
      filtering={true}
      onSearchTextChange={setUiSearchTerm}
      onSelectionChange={(tempSelectedItem) => {
        setUiSelectedItem(String(tempSelectedItem));
      }}
      searchBarAccessory={
        // Dropdown to select Shopping List
        <List.Dropdown
          tooltip="Show availability in a different country"
          onChange={selectList}
          defaultValue={currentList}
        >
          {allLists.map((singleList: any) => (
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
          && Object.values(itemList.purchase).map((item: any, index: number) => (
            <List.Item
              key={item.name}
              title={uiSelectedItem == item.name ? "" + item.name : item.name}
              icon={uiSelectedItem == item.name ? Icon.CheckCircle : Icon.Circle}
              id={item.name}
              actions={
                <ActionPanel>
                  <Action
                    title={`remove "${item.name}"`}
                    onAction={() => { removeItemFromList(item.name) }}
                    icon={Icon.Trash}
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
                onAction={uiAddSearchTermToList}
              />
            </ActionPanel>
          }
        />
      }

      {preferences.showRecent &&
        <List.Section title="Recently bought">
          {itemList
            && itemList.recently
            && Object.values(itemList.recently).map((item: any, index: number) => (
              <List.Item
                key={item.name}
                title={uiSelectedItem == item.name ? item.name : item.name}
                icon={uiSelectedItem == item.name ? Icon.Plus : Icon.Plus}
                id={item.name}
                actions={
                  <ActionPanel>
                    <Action
                      title={`add "${item.name}"`}
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
  );
}
