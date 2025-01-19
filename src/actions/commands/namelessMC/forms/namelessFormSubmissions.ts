import Redis from '#libs/Redis.js';
import CommandType from '#types/CommandType.js';
import createEmbed from '#utils/createEmbed.js';
import formatFieldName from '#utils/formatFieldName.js';
import getEmbedPageData from '#utils/getEmbedPageData.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

type SubmissionDataType = {
  id: number;
  form: { id: number; title: string };
  submitter: { id: number | null; username: string };
  created: number;
  last_updated: number;
  updated_by_user: { id: number | null; username: string };
  status: { id: number; name: string; open: number };
  fields: { question: string; field_type: number; answer: string }[];
};

type SubmissionType = {
  id: number;
  form_id: number;
  user_id: number | null;
  updated_by: number | null;
  created: number;
  last_updated: number;
  status_id: number;
  data: SubmissionDataType;
};

const command: CommandType = {
  name: 'nameless-form-submissions',
  description: 'View all the form submissions from your website.',
  permissions: [PermissionFlagsBits.Administrator],

  async script(_, interaction, debugStream) {
    debugStream.write('Fetching data...');

    const redisResult = await Redis.get('namelessmc-form-submissions');

    let submissions: SubmissionType[];

    if (redisResult) submissions = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL + '/forms/submissions',
        {
          headers: {
            Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
          },
        }
      );

      debugStream.write(`Response Status: ${response.status}`);

      debugStream.write('Getting JSON data...');
      const responseData = await response.json();

      if (responseData.error)
        throw new Error(
          `Failed to fetch from NamelessMC. Error: ${responseData.error}, ${
            responseData.message ? 'Message :' + responseData.message : ''
          }, ${responseData.meta ? 'Meta :' + responseData.meta : ''}`
        );

      submissions = await Promise.all(
        responseData.submissions.map(async (submission: any) => {
          const submissionResponse = await fetch(
            process.env.NAMELESSMC_API_URL +
              `/forms/submissions/${submission.id}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.NAMELESSMC_API_KEY}`,
              },
            }
          );

          const data = await submissionResponse.json();

          return { ...submission, data } as SubmissionType;
        })
      );

      await Redis.set(
        'namelessmc-form-submissions',
        JSON.stringify(submissions),
        {
          EX: 60_000,
        }
      );
    }

    if (!submissions.length) {
      debugStream.write('There are no submissions! Sending response...');
      await interaction.editReply('There are no submissions to view.');
      debugStream.write('Response sent!');
      return;
    }

    let formsData: { id: number; name: string }[] = [];
    let statusData: { id: number; name: string }[] = [];

    submissions.forEach((submission) => {
      const formName = submission.data.form.title;
      const statusName = submission.data.status.name;

      if (!formsData.find((form) => form.name === formName))
        formsData.push({ id: submission.form_id, name: formName });
      if (!statusData.find((status) => status.name === statusName))
        statusData.push({ id: submission.status_id, name: statusName });
    });

    debugStream.write('Data collected! Creating embed...');

    const firstSubmissions = submissions[0];

    const embedMessage = createEmbed({
      color: Colors.DarkGold,
      title: `[\`${firstSubmissions.id}\`] ${firstSubmissions.data.submitter.username}'s ${firstSubmissions.data.form.title}`,
      description: 'Use the menu below to navigate through each submission.',
      thumbnail: {
        url: 'https://i.postimg.cc/Kz6WKb69/Nameless-MC-Logo.png',
      },
      fields: getEmbedFields(firstSubmissions.data),
    });

    debugStream.write('Embed created! Creating components...');

    const pageBtnIDs = [
      'nameless-form-submissions-previous-collector',
      'nameless-form-submissions-next-collector',
    ];

    const previousBtn = new ButtonBuilder({
      customId: pageBtnIDs[0],
      disabled: true,
      emoji: '⬅',
      style: ButtonStyle.Primary,
    });

    const nextBtn = new ButtonBuilder({
      customId: pageBtnIDs[1],
      disabled: submissions.length === 1,
      emoji: '➡',
      style: ButtonStyle.Primary,
    });

    const pagesBtn = new ButtonBuilder({
      customId: 'nameless-form-submissions-pages-collector',
      disabled: true,
      style: ButtonStyle.Secondary,
      label: `Pages 1 of ${submissions.length}`,
    });

    const firstActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [previousBtn, pagesBtn, nextBtn],
    });

    const formFilter = new StringSelectMenuBuilder({
      customId: 'nameless-form-submissions-form-filter-collector',
      disabled: formsData.length === 1,
      options: [
        { label: 'All', value: '0' },
        ...formsData.map((form) => ({
          label: form.name,
          value: form.id.toString(),
        })),
      ],
    });

    const secondActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [formFilter],
    });

    const statusFilter = new StringSelectMenuBuilder({
      customId: 'nameless-form-submissions-status-filter-collector',
      disabled: statusData.length === 1,
      options: [
        { label: 'All', value: '0' },
        ...statusData.map((status) => ({
          label: status.name,
          value: status.id.toString(),
        })),
      ],
    });

    const thirdActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [statusFilter],
    });

    const searchBtn = new ButtonBuilder({
      customId: 'nameless-form-submissions-search-collector',
      disabled: submissions.length === 1,
      emoji: '🔍',
      style: ButtonStyle.Success,
      label: 'Search for a submission',
    });

    const forthActionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [searchBtn],
    });

    debugStream.write('Components created! Sending follow up...');

    const followUpMsg = await interaction.followUp({
      embeds: [embedMessage],
      components: [
        firstActionRow,
        secondActionRow,
        thirdActionRow,
        forthActionRow,
      ],
    });

    debugStream.write('Follow up sent!');

    if (submissions.length === 1) return;

    debugStream.write('Creating collectors...');

    let data = submissions;
    let currentPageIndex = 0;

    const pagesCollector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id && pageBtnIDs.includes(i.customId),
    });

    pagesCollector.on('collect', async (i) => {
      const result = getEmbedPageData(
        data,
        currentPageIndex,
        i.customId.split('-').includes('next'),
        firstActionRow
      );
      currentPageIndex = result.currentPageIndex;

      const pageData = result.pageData as SubmissionType;

      embedMessage.setTitle(
        `[\`${pageData.id}\`] ${pageData.data.submitter.username}'s ${pageData.data.form.title}`
      );
      embedMessage.setFields(getEmbedFields(pageData.data));

      await i.update({
        embeds: [embedMessage],
        components: [
          firstActionRow,
          secondActionRow,
          thirdActionRow,
          forthActionRow,
        ],
      });
    });

    let formID = 0;
    let statusID = 0;

    const formFilterCollector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === 'nameless-form-submissions-form-filter-collector',
    });

    formFilterCollector.on('collect', async (i) => {
      formID = Number(i.values[0]);
      data =
        formID === 0
          ? submissions.filter((s) =>
              statusID ? s.status_id === statusID : true
            )
          : submissions.filter((s) =>
              s.form_id === formID && statusID ? s.status_id === statusID : true
            );
      currentPageIndex = 0;

      const pageData = data[currentPageIndex];
      embedMessage.setTitle(
        `[\`${pageData.id}\`] ${pageData.data.submitter.username}'s ${pageData.data.form.title}`
      );
      embedMessage.setFields(getEmbedFields(pageData.data));

      previousBtn.setDisabled(true);
      nextBtn.setDisabled(data.length === 1);
      pagesBtn.setLabel(`Pages 1 of ${data.length}`);

      await i.update({
        embeds: [embedMessage],
        components: [
          firstActionRow,
          secondActionRow,
          thirdActionRow,
          forthActionRow,
        ],
      });
    });

    const statusFilterCollector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === 'nameless-form-submissions-status-filter-collector',
    });

    statusFilterCollector.on('collect', async (i) => {
      statusID = Number(i.values[0]);
      data =
        statusID === 0
          ? submissions.filter((s) => (formID ? s.form_id === formID : true))
          : submissions.filter((s) =>
              s.status_id === statusID && formID ? s.form_id === formID : true
            );
      currentPageIndex = 0;

      const pageData = data[currentPageIndex];
      embedMessage.setTitle(
        `[\`${pageData.id}\`] ${pageData.data.submitter.username}'s ${pageData.data.form.title}`
      );
      embedMessage.setFields(getEmbedFields(pageData.data));

      previousBtn.setDisabled(true);
      nextBtn.setDisabled(data.length === 1);
      pagesBtn.setLabel(`Pages 1 of ${data.length}`);

      await i.update({
        embeds: [embedMessage],
        components: [
          firstActionRow,
          secondActionRow,
          thirdActionRow,
          forthActionRow,
        ],
      });
    });

    const searchCollector = followUpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.customId === 'nameless-form-submissions-search-collector',
    });

    searchCollector.on('collect', async (i) => {
      const modal = new ModalBuilder({
        customId: 'search-modal-collector',
        title: 'Search Submissions',
      });

      const formIDInput = new TextInputBuilder({
        customId: 'formID',
        label: 'Form ID:',
        placeholder: 'Enter form ID...',
        required: false,
        style: TextInputStyle.Short,
      });

      const userIDInput = new TextInputBuilder({
        customId: 'userID',
        label: 'User ID:',
        placeholder: 'Enter user ID...',
        required: false,
        style: TextInputStyle.Short,
      });

      const statusIDInput = new TextInputBuilder({
        customId: 'statusID',
        label: 'Status ID:',
        placeholder: 'Enter status ID...',
        required: false,
        style: TextInputStyle.Short,
      });

      const updatedUserIDInput = new TextInputBuilder({
        customId: 'updated-userID',
        label: 'Updated User ID:',
        placeholder: 'Enter updated user ID...',
        required: false,
        style: TextInputStyle.Short,
      });

      const firstRow = new ActionRowBuilder<TextInputBuilder>({
        components: [formIDInput],
      });

      const secondRow = new ActionRowBuilder<TextInputBuilder>({
        components: [userIDInput],
      });

      const thirdRow = new ActionRowBuilder<TextInputBuilder>({
        components: [statusIDInput],
      });

      const forthRow = new ActionRowBuilder<TextInputBuilder>({
        components: [updatedUserIDInput],
      });

      modal.setComponents([firstRow, secondRow, thirdRow, forthRow]);

      await i.showModal(modal);

      const modalResponse = await i.awaitModalSubmit({
        time: 0,
        filter: (i) =>
          i.user.id === interaction.user.id &&
          i.customId === 'search-modal-collector',
      });

      await modalResponse.deferReply({ ephemeral: true });

      const formId = modalResponse.fields.getTextInputValue('formID');
      const userId = modalResponse.fields.getTextInputValue('userID');
      const statusId = modalResponse.fields.getTextInputValue('statusID');
      const updatedUserId =
        modalResponse.fields.getTextInputValue('updated-userID');

      if (!formId && !userId && !statusId && !updatedUserId) {
        await modalResponse.followUp('Please fill at least one field!');
        return;
      }

      const searchedSubmission = submissions.find((submission) => {
        if (formId && submission.form_id !== parseInt(formId)) return false;
        if (userId && submission.user_id !== parseInt(userId)) return false;
        if (statusId && submission.status_id !== parseInt(statusId))
          return false;
        if (updatedUserId && submission.updated_by !== parseInt(updatedUserId))
          return false;
        return true;
      });

      if (!searchedSubmission) {
        await modalResponse.followUp(
          'No submissions found matching your criteria!'
        );
        return;
      }

      embedMessage.setTitle(
        `[\`${searchedSubmission.id}\`] ${searchedSubmission.data.submitter.username}'s ${searchedSubmission.data.form.title}`
      );
      embedMessage.setFields(getEmbedFields(searchedSubmission.data));

      await modalResponse.followUp({
        embeds: [embedMessage],
      });
    });
  },
};

function getEmbedFields(submissionData: SubmissionDataType) {
  return [
    {
      name: "👤 User ID's:",
      value: `Creator: ${submissionData.submitter.id || 'N/A'}\nLast Update: ${
        submissionData.updated_by_user.id || 'N/A'
      }`,
      inline: true,
    },
    {
      name: '⌛ Updated By:',
      value: `Username: ${
        submissionData.updated_by_user.username || 'N/A'
      }\nTime: ${submissionData.last_updated}`,
    },
    {
      name: '📊 Status:',
      value: `Status: ${submissionData.status.name}\nForm Open: ${
        submissionData.status.open ? '✔' : '❌'
      }`,
      inline: true,
    },
    {
      name: '🕖 Created:',
      value: `<t:${submissionData.created}>`,
    },
    ...submissionData.fields.map((field) => {
      let fileData: any;

      if (field.field_type === 10 && field.answer)
        fileData = parseDataURI(field.answer);

      return {
        name: `❓ ${formatFieldName(field.question)}:`,
        value:
          field.field_type === 10
            ? fileData
              ? `[${fileData.fileName}](${fileData.url})`
              : 'No answer'
            : `${field.answer || 'No answer'}`,
        inline: true,
      };
    }),
  ];
}

function parseDataURI(dataURI: string) {
  // Extract content type and base64 data
  const matches = dataURI.match(/^data:(.+);base64,(.+)$/);

  if (!matches) {
    throw new Error('Invalid data URI format');
  }

  const contentType = matches[1];
  const base64Data = matches[2];

  // Get file extension from content type
  const extension = contentType.split('/')[1];

  // Generate filename with timestamp
  const fileName = `IMG_${new Date().getFullYear()}.${extension}`;

  // Create object URL (temporary URL to the data)
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: contentType });
  const url = URL.createObjectURL(blob);

  return {
    fileName,
    url,
    contentType,
    base64Data,
  };
}

export default command;
