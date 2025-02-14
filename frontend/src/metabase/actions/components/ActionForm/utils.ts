import { t } from "ttag";
import * as Yup from "yup";

import type {
  ActionFormSettings,
  ActionFormOption,
  FieldSettingsMap,
  InputSettingType,
  InputComponentType,
  Parameter,
  WritebackParameter,
  FieldType,
} from "metabase-types/api";
import type {
  ActionFormProps,
  ActionFormFieldProps,
  FieldSettings,
} from "metabase/actions/types";

import { sortActionParams, isEditableField } from "metabase/actions/utils";
import { isEmpty } from "metabase/lib/validate";

const getOptionsFromArray = (
  options: (number | string)[],
): ActionFormOption[] => options.map(o => ({ name: o, value: o }));

export const inputTypeHasOptions = (inputType: InputSettingType) =>
  ["select", "radio"].includes(inputType);

type FieldPropTypeMap = Record<InputSettingType, InputComponentType>;

const fieldPropsTypeMap: FieldPropTypeMap = {
  string: "text",
  text: "textarea",
  date: "date",
  datetime: "datetime-local",
  time: "time",
  number: "number",
  boolean: "boolean",
  category: "category",
  select: "select",
  radio: "radio",
};

function getSampleOptions(fieldType: FieldType) {
  return fieldType === "number"
    ? getOptionsFromArray([1, 2, 3])
    : getOptionsFromArray([t`Option One`, t`Option Two`, t`Option Three`]);
}

export const getFormField = (
  parameter: Parameter,
  fieldSettings: FieldSettings,
) => {
  if (
    fieldSettings.field &&
    !isEditableField(fieldSettings.field, parameter as Parameter)
  ) {
    return undefined;
  }

  const fieldProps: ActionFormFieldProps = {
    name: parameter.id,
    type: fieldPropsTypeMap[fieldSettings?.inputType] ?? "text",
    title:
      fieldSettings.title ||
      fieldSettings.name ||
      parameter["display-name"] ||
      parameter.name ||
      parameter.id,
    description: fieldSettings.description ?? "",
    placeholder: fieldSettings?.placeholder,
    optional: !fieldSettings.required,
    field: fieldSettings.field,
  };

  if (inputTypeHasOptions(fieldSettings.inputType)) {
    fieldProps.options = fieldSettings.valueOptions?.length
      ? getOptionsFromArray(fieldSettings.valueOptions)
      : getSampleOptions(fieldSettings.fieldType);
  }

  return fieldProps;
};

export const getForm = (
  parameters: WritebackParameter[] | Parameter[],
  fieldSettings: Record<string, FieldSettings> = {},
): ActionFormProps => {
  const sortedParams = parameters.sort(
    sortActionParams({ fields: fieldSettings } as ActionFormSettings),
  );
  return {
    fields: sortedParams
      ?.map(param => getFormField(param, fieldSettings[param.id] ?? {}))
      .filter(Boolean) as ActionFormFieldProps[],
  };
};

const getFieldValidationType = (fieldSettings: FieldSettings) => {
  switch (fieldSettings.inputType) {
    case "number":
      return Yup.number();
    case "boolean":
      return Yup.boolean();
    case "date":
    case "datetime":
    case "time":
      // for dates, cast empty strings to null
      return Yup.string().transform((value, originalValue) =>
        originalValue?.length ? value : null,
      );
    default:
      return Yup.string();
  }
};

export const getFormValidationSchema = (
  parameters: WritebackParameter[] | Parameter[],
  fieldSettings: FieldSettingsMap = {},
) => {
  const requiredMessage = t`This field is required`;

  const schema = Object.values(fieldSettings)
    .filter(fieldSetting =>
      // only validate fields that are present in the form
      parameters.find(parameter => parameter.id === fieldSetting.id),
    )
    .map(fieldSetting => {
      let yupType: Yup.AnySchema = getFieldValidationType(fieldSetting);

      if (fieldSetting.required) {
        yupType = yupType.required(requiredMessage);
      } else {
        yupType = yupType.nullable();
      }

      if (!isEmpty(fieldSetting.defaultValue)) {
        yupType = yupType.default(fieldSetting.defaultValue);
      }

      return [fieldSetting.id, yupType];
    });
  return Yup.object(Object.fromEntries(schema));
};
