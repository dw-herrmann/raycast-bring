import { Toast, closeMainWindow, showToast } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";



// open bring in browser
export default async function command() {

  const url = "https://web.getbring.com/app/lists/";

  const openInBrowser = async (url: string) => {
    // open in default browser
    await runAppleScript(`
      open location "${url}"
    `);
  };


  try {
    await closeMainWindow();
    await openInBrowser(url);

  } catch (error) {
    await showToast({
      title: "Failed opening new window",
      style: Toast.Style.Failure,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
