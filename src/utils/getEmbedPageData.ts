import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

export default function (
  dataArray: any[],
  currentPageIndex: number,
  toNextPage: boolean,
  actionRow: ActionRowBuilder<ButtonBuilder>
) {
  const maxPages = dataArray.length;
  const [previousBtn, pagesBtn, nextBtn] = actionRow.components;

  if (toNextPage) currentPageIndex++;
  else currentPageIndex--;

  if (currentPageIndex < 0) currentPageIndex = 0;

  //maxPages = no of elements
  if (currentPageIndex >= maxPages) currentPageIndex = maxPages - 1;

  if (currentPageIndex === 0) {
    previousBtn.setDisabled(true);
    nextBtn.setDisabled(false);

    pagesBtn.setLabel(`Pages 1 of ${maxPages}`);

    return { pageData: dataArray[currentPageIndex], currentPageIndex };
  }

  if (currentPageIndex === maxPages - 1) {
    previousBtn.setDisabled(false);
    nextBtn.setDisabled(true);

    pagesBtn.setLabel(`Pages ${maxPages} of ${maxPages}`);

    return { pageData: dataArray[currentPageIndex], currentPageIndex };
  }

  //rest of code is for pages in-between

  previousBtn.setDisabled(false);
  nextBtn.setDisabled(false);

  pagesBtn.setLabel(`Pages ${currentPageIndex + 1} of ${maxPages}`);

  return { pageData: dataArray[currentPageIndex], currentPageIndex };
}
