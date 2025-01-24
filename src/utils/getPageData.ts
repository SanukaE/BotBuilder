import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

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
