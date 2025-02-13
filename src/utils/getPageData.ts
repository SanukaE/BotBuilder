import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Creates a row of navigation buttons for paginated data display.
 * 
 * @param buttonID - Array of string IDs for the navigation buttons in order:
 *                  [firstPage, previous, pages, next, lastPage]
 * @param dataArray - Array of data items to be paginated
 * @returns An ActionRowBuilder containing navigation buttons. If dataArray has only
 *          one item, returns a single disabled message button instead.
 * 
 * @remarks
 * The function creates up to 5 buttons:
 * - First page button (◀)
 * - Previous page button (⬅)
 * - Page indicator button showing current/total pages
 * - Next page button (➡)
 * - Last page button (▶)
 * 
 * Initial button states:
 * - First/Previous buttons are disabled by default
 * - Next/Last buttons are disabled if dataArray has only one item
 * - Page indicator shows "Page 1 of {total pages}"
 */
export function createPageButtons(buttonID: string[], dataArray: any[]) {
  const firstPageBtn = new ButtonBuilder({
    customId: buttonID[0],
    disabled: true,
    emoji: '◀',
    style: ButtonStyle.Primary,
  });

  const previousBtn = new ButtonBuilder({
    customId: buttonID[1],
    disabled: true,
    emoji: '⬅',
    style: ButtonStyle.Primary,
  });

  const pagesBtn = new ButtonBuilder({
    customId: buttonID[2],
    disabled: true,
    style: ButtonStyle.Secondary,
    label: `Page 1 of ${dataArray.length}`,
  });

  const nextBtn = new ButtonBuilder({
    customId: buttonID[3],
    disabled: dataArray.length === 1,
    emoji: '➡',
    style: ButtonStyle.Primary,
  });

  const lastPageBtn = new ButtonBuilder({
    customId: buttonID[4],
    disabled: dataArray.length === 1,
    emoji: '▶',
    style: ButtonStyle.Primary,
  });

  const messageBtn = new ButtonBuilder({
    customId: 'message-button',
    disabled: true,
    style: ButtonStyle.Secondary,
    label: 'This is the only data found',
  });

  const actionRow = new ActionRowBuilder<ButtonBuilder>({
    components:
      dataArray.length === 1
        ? [messageBtn]
        : [firstPageBtn, previousBtn, pagesBtn, nextBtn, lastPageBtn],
  });

  return actionRow;
}

/**
 * Updates navigation buttons state and returns data for the current page based on user interaction.
 * 
 * @param dataArray - Array of data items being paginated
 * @param currentPageIndex - Current page index (zero-based)
 * @param interactionID - ID of the button interaction that triggered navigation
 * @param actionRow - Action row containing navigation buttons created by createPageButtons()
 * @returns Object containing the data for current page and updated page index
 * 
 * @remarks
 * The function handles page navigation logic:
 * - Updates button disabled states based on current page
 * - Handles navigation to first/last pages
 * - Updates page indicator text
 * - Returns data for the new current page
 * 
 * Button interaction IDs are expected to contain:
 * - "next" for next page navigation
 * - "previous" for previous page navigation  
 * - "end" combined with above for first/last page navigation
 * 
 * @example
 * ```typescript
 * const result = getPageData(myData, 0, "btn-next", actionRow);
 * console.log(result.currentPageIndex); // 1
 * console.log(result.data); // Data for page 1
 * ```
 */
export function getPageData(
  dataArray: any[],
  currentPageIndex: number,
  interactionID: string,
  actionRow: ActionRowBuilder<ButtonBuilder>
) {
  const maxPages = dataArray.length;
  const [firstPageBtn, previousBtn, pagesBtn, nextBtn, lastPageBtn] =
    actionRow.components;

  const toNextPage = interactionID.split('-').includes('next');
  const toPreviousPage = interactionID.split('-').includes('previous');
  const toEnd = interactionID.split('-').includes('end');

  // Handle navigation based on button clicked
  if (toNextPage) {
    if (toEnd) {
      // Last page button
      currentPageIndex = maxPages - 1;
      firstPageBtn.setDisabled(false);
      previousBtn.setDisabled(false);
      nextBtn.setDisabled(true);
      lastPageBtn.setDisabled(true);
    } else {
      // Next page button
      currentPageIndex++;
      firstPageBtn.setDisabled(false);
      previousBtn.setDisabled(false);
      nextBtn.setDisabled(currentPageIndex === maxPages - 1);
      lastPageBtn.setDisabled(currentPageIndex === maxPages - 1);
    }
  } else if (toPreviousPage) {
    if (toEnd) {
      // First page button
      currentPageIndex = 0;
      firstPageBtn.setDisabled(true);
      previousBtn.setDisabled(true);
      nextBtn.setDisabled(false);
      lastPageBtn.setDisabled(false);
    } else {
      // Previous page button
      currentPageIndex--;
      firstPageBtn.setDisabled(currentPageIndex === 0);
      previousBtn.setDisabled(currentPageIndex === 0);
      nextBtn.setDisabled(false);
      lastPageBtn.setDisabled(false);
    }
  }

  // Update page indicator
  pagesBtn.setLabel(`Page ${currentPageIndex + 1} of ${maxPages}`);

  return { data: dataArray[currentPageIndex], currentPageIndex };
}
