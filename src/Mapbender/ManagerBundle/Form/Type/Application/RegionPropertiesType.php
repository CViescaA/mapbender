<?php


namespace Mapbender\ManagerBundle\Form\Type\Application;


use Mapbender\CoreBundle\Component\Template;
use Mapbender\CoreBundle\Entity\Application;
use Mapbender\CoreBundle\Utils\ArrayUtil;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormView;
use Symfony\Component\HttpKernel\Kernel;
use Symfony\Component\OptionsResolver\Options;
use Symfony\Component\OptionsResolver\OptionsResolver;

class RegionPropertiesType extends AbstractType
{
    public function getBlockPrefix()
    {
        return 'application_region_properties';
    }

    public function getParent()
    {
        return 'Symfony\Component\Form\Extension\Core\Type\ChoiceType';
    }

    public function configureOptions(OptionsResolver $resolver)
    {
        // No use ($this) in old PHP...
        $self = $this;
        $resolver->setDefaults(array(
            'application' => null,
            'region' => null,
            'mapped' => false,
            'required' => false,
            'expanded' => true,
            'multiple' => false,
            'choices' => function (Options $options) use ($self) {
                return $self->buildChoices($options);
            },
            'choices_as_values' => true,
            'data' => function (Options $options) use ($self) {
                return $self->getData($options);
            }
        ));
    }

    public function buildChoices(Options $options)
    {
        /** @var Application $application */
        $application = $options['application'];
        $templateClassName = $application->getTemplate();
        /** @var Template|string $templateClassName */
        $templateRegionProps = $templateClassName::getRegionsProperties();
        $choices = array();
        if (Kernel::MAJOR_VERSION >= 3 || $options['choices_as_values']) {
            foreach ($templateRegionProps[$options['region']] as $choiceDef) {
                $choices[$choiceDef['label']] = $choiceDef['name'];
            }
        } else {
            foreach ($templateRegionProps[$options['region']] as $choiceDef) {
                $choices[$choiceDef['name']] = $choiceDef['label'];
            }
        }
        return $choices;
    }

    public function getData(Options $options)
    {
        /** @var Application $application */
        $application = $options['application'];
        foreach ($application->getRegionProperties() as $regionProperty) {
            if ($regionProperty->getName() === $options['region']) {
                $values = $regionProperty->getProperties();
                return ArrayUtil::getDefault($values, 'name', null);
            }
        }
        return null;
    }

    public function buildView(FormView $view, FormInterface $form, array $options)
    {
        $view->vars['iconMap'] = array(
            '' => 'fa fa-square-o', // @todo Fontawesome 5: far fa-square; or find some other icon
            'tabs' => 'fa fas fa-folder',
            'accordion' => 'fa fas fa-bars',
        );
    }
}
