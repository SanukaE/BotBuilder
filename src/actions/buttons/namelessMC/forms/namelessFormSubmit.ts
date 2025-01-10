import Redis from '#libs/Redis.js';
import ButtonType from '#types/ButtonType.js';
import {
  ActionRowBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

let form: any;

const button: ButtonType = {
  customID: 'nameless-forms-discord-submit', //nameless-forms-discord-submit-${formID}
  isDisabled: true, //! W.I.P

  async script(_, interaction, debugStream) {
    debugStream.write('Getting data from interaction...');

    const formID = interaction.customId.split('-')[4];

    debugStream.write(`formID: ${formID}`);

    debugStream.write('Fetching data...');

    const redisResult = await Redis.get(`namelessmc-form-${formID}`);

    if (redisResult) form = JSON.parse(redisResult);
    else {
      const response = await fetch(
        process.env.NAMELESSMC_API_URL + `/forms/${formID}`,
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

      form = responseData;

      await Redis.set(`namelessmc-form-${formID}`, JSON.stringify(form), {
        EX: 60_000,
      });
    }

    debugStream.write('Data collected! Creating embed...');
  },
};

//! W.I.P
function createQuestionField(field: any) {
  let builder: ModalBuilder | StringSelectMenuBuilder | undefined;

  if (field.type === 1 || field.type === 3 || field.type === 7) {
    builder = new ModalBuilder({
      customId: `${field.id}-${field.type}`,
      title: `${form.title} [Q. ${field.id}]`,
    });

    const answerInput = new TextInputBuilder({
      customId: `${field.id}-text-input`,
      label: field.name,
      maxLength: field.max,
      minLength: field.min,
      placeholder: field.placeholder,
      required: field.required,
      style:
        field.type === 1 || field.type === 7
          ? TextInputStyle.Short
          : TextInputStyle.Paragraph,
    });

    const actionRow = new ActionRowBuilder<TextInputBuilder>({
      components: [answerInput],
    });

    builder.addComponents(actionRow);
  }
}

export default button;
